-- ============================================================
-- THE ASHTRAY KING — Migration 011 : chat de clan et messages entre amis
-- Tout passe par des fonctions serveur (le navigateur n'écrit jamais dans les tables). Messages gardés 30 jours.
-- ============================================================
create table if not exists public.chat_messages (
  id bigserial primary key,
  scope text not null check (scope in ('clan', 'dm')),
  clan_id uuid references public.clans(id) on delete cascade,
  user_a uuid references public.profiles(id) on delete cascade,     -- DM : le plus petit des deux identifiants
  user_b uuid references public.profiles(id) on delete cascade,
  sender uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  check ((scope = 'clan' and clan_id is not null) or (scope = 'dm' and user_a is not null and user_b is not null and user_a < user_b))
);
create index if not exists chat_clan on public.chat_messages (clan_id, id desc) where scope = 'clan';
create index if not exists chat_dm on public.chat_messages (user_a, user_b, id desc) where scope = 'dm';
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;

create table if not exists public.chat_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  k text not null,                       -- 'clan' ou 'dm:<identifiant de l'ami>'
  last_id bigint not null default 0,
  primary key (user_id, k)
);
alter table public.chat_reads enable row level security;
revoke all on public.chat_reads from anon, authenticated;

create table if not exists public.chat_reports (
  id bigserial primary key,
  message_id bigint not null references public.chat_messages(id) on delete cascade,
  reporter uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  handled boolean not null default false,
  unique (message_id, reporter)
);
alter table public.chat_reports enable row level security;
revoke all on public.chat_reports from anon, authenticated;

create or replace function public._my_clan() returns uuid language sql security definer set search_path = public stable as $$
  select clan_id from public.clan_members where user_id = auth.uid();
$$;
revoke all on function public._my_clan() from public, anon, authenticated;

-- Envoi : p_scope = 'clan' (p_target ignoré) ou 'dm' (p_target = ami)
create or replace function public.chat_send(p_scope text, p_target uuid, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b text; cid uuid; mid bigint; a uuid; c uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('chat', 20, 60);
  b := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'));
  if char_length(b) < 1 then raise exception 'Message vide'; end if;
  if char_length(b) > 300 then raise exception 'Message trop long (300 caractères)'; end if;
  if p_scope = 'clan' then
    cid := public._my_clan();
    if cid is null then raise exception 'Tu n''es dans aucun clan'; end if;
    insert into public.chat_messages (scope, clan_id, sender, body) values ('clan', cid, uid, b) returning id into mid;
  elsif p_scope = 'dm' then
    if p_target is null or not public._are_friends(uid, p_target) then raise exception 'Vous n''êtes pas amis'; end if;
    a := least(uid, p_target); c := greatest(uid, p_target);
    insert into public.chat_messages (scope, user_a, user_b, sender, body) values ('dm', a, c, uid, b) returning id into mid;
  else raise exception 'Salon inconnu';
  end if;
  return mid;
end;
$$;
revoke all on function public.chat_send(text, uuid, text) from public, anon, authenticated;
grant execute on function public.chat_send(text, uuid, text) to authenticated;

-- Lecture : les 50 derniers messages (p_after = 0) ou ceux arrivés après p_after
create or replace function public.chat_list(p_scope text, p_target uuid, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare uid uuid := auth.uid(); r jsonb; cid uuid; a uuid; c uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if p_scope = 'clan' then
    cid := public._my_clan();
    if cid is null then return '[]'::jsonb; end if;
    select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) into r from (
      select m.id, m.body, m.created_at as at, m.sender, p.pseudo, (m.sender = uid) as mine
        from public.chat_messages m join public.profiles p on p.id = m.sender
       where m.scope = 'clan' and m.clan_id = cid and not m.deleted and m.id > coalesce(p_after, 0)
       order by m.id desc limit 50) x;
  elsif p_scope = 'dm' then
    if p_target is null or not public._are_friends(uid, p_target) then return '[]'::jsonb; end if;
    a := least(uid, p_target); c := greatest(uid, p_target);
    select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) into r from (
      select m.id, m.body, m.created_at as at, m.sender, p.pseudo, (m.sender = uid) as mine
        from public.chat_messages m join public.profiles p on p.id = m.sender
       where m.scope = 'dm' and m.user_a = a and m.user_b = c and not m.deleted and m.id > coalesce(p_after, 0)
       order by m.id desc limit 50) x;
  else raise exception 'Salon inconnu';
  end if;
  return r;
end;
$$;
revoke all on function public.chat_list(text, uuid, bigint) from public, anon, authenticated;
grant execute on function public.chat_list(text, uuid, bigint) to authenticated;

create or replace function public.chat_mark_read(p_scope text, p_target uuid, p_last bigint) returns void
language plpgsql security definer set search_path = public as $$
declare rk text := case when p_scope = 'clan' then 'clan' else 'dm:' || p_target::text end;
begin
  if auth.uid() is null or p_last is null then return; end if;
  insert into public.chat_reads as cr (user_id, k, last_id) values (auth.uid(), rk, p_last)
  on conflict (user_id, k) do update set last_id = greatest(cr.last_id, excluded.last_id);
end;
$$;
revoke all on function public.chat_mark_read(text, uuid, bigint) from public, anon, authenticated;
grant execute on function public.chat_mark_read(text, uuid, bigint) to authenticated;

-- Messages non lus : { clan: n, dm: { id_ami: n } }
create or replace function public.chat_unread() returns jsonb language plpgsql security definer set search_path = public stable as $$
declare uid uuid := auth.uid(); cid uuid := public._my_clan(); lc bigint; n int; d jsonb;
begin
  if uid is null then return '{}'::jsonb; end if;
  select coalesce(last_id, 0) into lc from public.chat_reads where user_id = uid and k = 'clan';
  select count(*) into n from public.chat_messages m where cid is not null and m.scope = 'clan' and m.clan_id = cid and m.sender <> uid and not m.deleted and m.id > coalesce(lc, 0);
  select coalesce(jsonb_object_agg(other, cnt), '{}'::jsonb) into d from (
    select m.sender as other, count(*) cnt from public.chat_messages m
     where m.scope = 'dm' and uid in (m.user_a, m.user_b) and m.sender <> uid and not m.deleted
       and m.id > coalesce((select last_id from public.chat_reads r where r.user_id = uid and r.k = 'dm:' || m.sender::text), 0)
     group by m.sender) q;
  return jsonb_build_object('clan', coalesce(n, 0), 'dm', d);
end;
$$;
revoke all on function public.chat_unread() from public, anon, authenticated;
grant execute on function public.chat_unread() to authenticated;

create or replace function public.chat_report(p_id bigint, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.chat_messages%rowtype;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('chat_report', 10, 3600);
  select * into m from public.chat_messages where id = p_id;
  if not found then raise exception 'Message introuvable'; end if;
  if not ((m.scope = 'clan' and m.clan_id = public._my_clan()) or (m.scope = 'dm' and uid in (m.user_a, m.user_b))) then raise exception 'Message introuvable'; end if;
  if m.sender = uid then raise exception 'C''est ton message'; end if;
  insert into public.chat_reports (message_id, reporter, reason) values (p_id, uid, left(p_reason, 200)) on conflict do nothing;
end;
$$;
revoke all on function public.chat_report(bigint, text) from public, anon, authenticated;
grant execute on function public.chat_report(bigint, text) to authenticated;

-- ── Admin : signalements et suppression ──
create or replace function public.admin_chat_reports() returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  select coalesce(jsonb_agg(row_to_json(q) order by q.at desc), '[]'::jsonb) into r from (
    select rp.id, rp.message_id, rp.reason, rp.created_at as at, rp.handled, m.body, m.scope, m.deleted, m.sender, ps.pseudo as sender_pseudo, pr.pseudo as reporter_pseudo
      from public.chat_reports rp join public.chat_messages m on m.id = rp.message_id
      join public.profiles ps on ps.id = m.sender join public.profiles pr on pr.id = rp.reporter
     order by rp.created_at desc limit 100) q;
  return r;
end;
$$;
revoke all on function public.admin_chat_reports() from public, anon, authenticated;
grant execute on function public.admin_chat_reports() to authenticated;

create or replace function public.admin_chat_delete(p_message bigint, p_handled boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare ps text; m public.chat_messages%rowtype;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  select * into m from public.chat_messages where id = p_message;
  if not found then return; end if;
  update public.chat_messages set deleted = true where id = p_message;
  update public.chat_reports set handled = true where message_id = p_message;
  select pseudo into ps from public.profiles where id = m.sender;
  insert into public.admin_log (admin_id, action, target_id, target_pseudo, detail) values (auth.uid(), 'message supprimé', m.sender, ps, jsonb_build_object('note', left(m.body, 120)));
end;
$$;
revoke all on function public.admin_chat_delete(bigint, boolean) from public, anon, authenticated;
grant execute on function public.admin_chat_delete(bigint, boolean) to authenticated;

create or replace function public.admin_chat_dismiss(p_report bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  update public.chat_reports set handled = true where id = p_report;
end;
$$;
revoke all on function public.admin_chat_dismiss(bigint) from public, anon, authenticated;
grant execute on function public.admin_chat_dismiss(bigint) to authenticated;

-- Nettoyage : messages de plus de 30 jours
select cron.unschedule('chat-nettoyage') where exists (select 1 from cron.job where jobname = 'chat-nettoyage');
select cron.schedule('chat-nettoyage', '50 1 * * *', $$delete from public.chat_messages where created_at < now() - interval '30 days'$$);
