-- ============================================================
-- THE ASHTRAY KING — Migration 028 : évènements (tournois de poker créés par l'admin)
-- Plus de tournois créés par les joueurs : l'admin programme un évènement (date, droit d'entrée, cagnotte offerte) ;
-- les joueurs s'inscrivent à l'avance ; à l'heure dite le serveur ouvre la table et assoit tout le monde.
-- Les tables d'argent (cash) restent créables par les joueurs.
-- ============================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 40),
  description text check (description is null or char_length(description) <= 240),
  starts_at timestamptz not null,
  fee numeric not null default 0 check (fee between 0 and 100000000),
  max_players int not null default 6 check (max_players between 2 and 6),
  prize numeric not null default 0 check (prize between 0 and 1000000000000),
  status text not null default 'scheduled' check (status in ('scheduled', 'running', 'done', 'cancelled')),
  table_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.event_regs (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.events enable row level security;
alter table public.event_regs enable row level security;
revoke all on public.events, public.event_regs from anon, authenticated;

-- Les joueurs ne créent plus de tournoi
create or replace function public.poker_tourney_create(p_name text, p_fee numeric, p_max int) returns uuid language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Les tournois sont organisés par la maison : regarde les évènements à venir';
end;
$$;

-- Départ du tournoi : la cagnotte offerte par l'évènement s'ajoute à celle des droits d'entrée
create or replace function public._pk_tourney_start(tid uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.poker_tables%rowtype; cnt int; plist jsonb;
begin
  select * into t from public.poker_tables where id = tid for update;
  select count(*), jsonb_agg(jsonb_build_object('uid', s.user_id, 'pseudo', p.pseudo)) into cnt, plist from public.poker_seats s join public.profiles p on p.id = s.user_id where s.table_id = tid;
  update public.poker_tables set sb = 10, bb = 20, next_hand_at = now() + interval '4 seconds', last_activity = now(),
    tourney = t.tourney || jsonb_build_object('status', 'running', 'started_at', now(), 'level', 1, 'players', plist,
      'pool', floor((t.tourney ->> 'fee')::numeric * 0.6) * cnt + coalesce((t.tourney ->> 'event_prize')::numeric, 0),
      'bounty_each', floor((t.tourney ->> 'fee')::numeric * 0.4), 'places', '[]'::jsonb, 'kills', '{}'::jsonb, 'bounty_won', '{}'::jsonb, 'forfeit', 0)
   where id = tid;
end;
$$;
revoke all on function public._pk_tourney_start(uuid) from public, anon, authenticated;

-- ── Côté admin ──
create or replace function public.admin_event_create(p_title text, p_desc text, p_starts timestamptz, p_fee numeric, p_max int, p_prize numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  if p_starts is null or p_starts < now() + interval '2 minutes' then raise exception 'La date de départ doit être dans le futur'; end if;
  insert into public.events (title, description, starts_at, fee, max_players, prize, created_by)
    values (left(btrim(p_title), 40), nullif(left(btrim(coalesce(p_desc, '')), 240), ''), p_starts, round(coalesce(p_fee, 0)), coalesce(p_max, 6), round(coalesce(p_prize, 0)), auth.uid()) returning id into eid;
  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), 'event_create', jsonb_build_object('event', eid, 'title', p_title, 'starts', p_starts, 'fee', p_fee, 'prize', p_prize));
  return eid;
end;
$$;
create or replace function public.admin_events() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'description', e.description, 'starts_at', e.starts_at, 'fee', e.fee, 'max', e.max_players, 'prize', e.prize, 'status', e.status,
    'regs', (select count(*) from public.event_regs r where r.event_id = e.id),
    'players', (select coalesce(jsonb_agg(p.pseudo), '[]'::jsonb) from public.event_regs r join public.profiles p on p.id = r.user_id where r.event_id = e.id)) order by e.starts_at desc)
    from (select * from public.events order by starts_at desc limit 40) e), '[]'::jsonb);
end;
$$;
create or replace function public.admin_event_cancel(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype; r record;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  select * into e from public.events where id = p_id for update;
  if not found or e.status <> 'scheduled' then raise exception 'Cet évènement ne peut plus être annulé'; end if;
  for r in select user_id from public.event_regs where event_id = p_id loop
    if e.fee > 0 then perform public._pk_grant(r.user_id, e.fee, 'Évènement annulé : droit d''entrée remboursé'); end if;
  end loop;
  update public.events set status = 'cancelled' where id = p_id;
  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), 'event_cancel', jsonb_build_object('event', p_id, 'title', e.title));
end;
$$;

-- ── Côté joueur ──
create or replace function public.events_list() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return '[]'::jsonb; end if;
  perform public._event_tick();
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'description', e.description, 'starts_at', e.starts_at, 'fee', e.fee, 'max', e.max_players, 'prize', e.prize, 'status', e.status,
    'regs', (select count(*) from public.event_regs r where r.event_id = e.id),
    'mine', exists (select 1 from public.event_regs r where r.event_id = e.id and r.user_id = uid),
    'table_id', case when e.status = 'running' and exists (select 1 from public.poker_seats s where s.table_id = e.table_id and s.user_id = uid) then e.table_id end) order by e.starts_at)
    from public.events e where e.status in ('scheduled', 'running') and e.starts_at > now() - interval '3 hours'), '[]'::jsonb);
end;
$$;
create or replace function public.event_register(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e public.events%rowtype; n int;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('event_reg', 20, 600);
  select * into e from public.events where id = p_id for update;
  if not found or e.status <> 'scheduled' or e.starts_at <= now() then raise exception 'Les inscriptions sont fermées'; end if;
  if exists (select 1 from public.event_regs where event_id = p_id and user_id = uid) then raise exception 'Tu es déjà inscrit'; end if;
  select count(*) into n from public.event_regs where event_id = p_id;
  if n >= e.max_players then raise exception 'Évènement complet'; end if;
  if e.fee > 0 and public._pk_cash(uid) < e.fee then raise exception 'Pas assez d''argent pour le droit d''entrée (sauvegarde en ligne à jour ?)'; end if;
  insert into public.event_regs (event_id, user_id) values (p_id, uid);
  if e.fee > 0 then perform public._pk_grant(uid, -e.fee, 'Évènement « ' || e.title || ' » : droit d''entrée'); end if;
end;
$$;
create or replace function public.event_unregister(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e public.events%rowtype;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select * into e from public.events where id = p_id for update;
  if not found or e.status <> 'scheduled' or e.starts_at <= now() + interval '30 seconds' then raise exception 'Trop tard pour se désinscrire'; end if;
  delete from public.event_regs where event_id = p_id and user_id = uid;
  if found and e.fee > 0 then perform public._pk_grant(uid, e.fee, 'Évènement « ' || e.title || ' » : désinscription, droit d''entrée remboursé'); end if;
end;
$$;

-- Lance les évènements dont l'heure est venue (cron chaque minute + à chaque consultation de la liste)
create or replace function public._event_tick() returns void language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype; regs uuid[]; tid uuid; i int; r uuid;
begin
  for e in select * from public.events where status = 'scheduled' and starts_at <= now() order by starts_at for update skip locked loop
    select coalesce(array_agg(user_id order by created_at), '{}') into regs from public.event_regs where event_id = e.id;
    -- quelqu'un joue déjà à une table : il est retiré de l'évènement (remboursé)
    foreach r in array regs loop
      if exists (select 1 from public.poker_seats where user_id = r) then
        delete from public.event_regs where event_id = e.id and user_id = r;
        if e.fee > 0 then perform public._pk_grant(r, e.fee, 'Évènement « ' || e.title || ' » : tu étais déjà à une table, droit d''entrée remboursé'); end if;
        regs := array_remove(regs, r);
      end if;
    end loop;
    if coalesce(cardinality(regs), 0) < 2 then
      foreach r in array regs loop if e.fee > 0 then perform public._pk_grant(r, e.fee, 'Évènement « ' || e.title || ' » annulé (pas assez d''inscrits) : remboursé'); end if; end loop;
      update public.events set status = 'cancelled' where id = e.id;
      continue;
    end if;
    insert into public.poker_tables (owner, name, buyin, sb, bb, max_seats, kind, tourney)
      values (regs[1], e.title, e.fee, 10, 20, greatest(2, cardinality(regs)), 'tournoi',
        jsonb_build_object('status', 'registering', 'fee', e.fee, 'max', cardinality(regs), 'chips', 1500, 'pool', 0, 'bounty_each', floor(e.fee * 0.4), 'level', 1, 'places', '[]'::jsonb, 'event_id', e.id, 'event_prize', e.prize))
      returning id into tid;
    insert into public.poker_secrets (table_id) values (tid);
    for i in 1..cardinality(regs) loop
      insert into public.poker_seats (table_id, seat, user_id, stack) values (tid, i, regs[i], 1500);
      perform public._push_notify(regs[i], e.title, 'Ton tournoi commence : ta place est à la table !', 'event-' || e.id::text);
    end loop;
    perform public._pk_tourney_start(tid);
    update public.events set status = 'running', table_id = tid where id = e.id;
  end loop;
  -- évènements terminés
  update public.events ev set status = 'done' where ev.status = 'running' and exists (select 1 from public.poker_tables t where t.id = ev.table_id and t.tourney ->> 'status' = 'done');
  update public.events ev set status = 'done' where ev.status = 'running' and not exists (select 1 from public.poker_tables t where t.id = ev.table_id);
end;
$$;

revoke all on function public._event_tick() from public, anon, authenticated;
revoke all on function public.poker_tourney_create(text, numeric, int) from public, anon, authenticated;
revoke all on function public.admin_event_create(text, text, timestamptz, numeric, int, numeric) from public, anon, authenticated;
revoke all on function public.admin_events() from public, anon, authenticated;
revoke all on function public.admin_event_cancel(uuid) from public, anon, authenticated;
revoke all on function public.events_list() from public, anon, authenticated;
revoke all on function public.event_register(uuid) from public, anon, authenticated;
revoke all on function public.event_unregister(uuid) from public, anon, authenticated;
grant execute on function public.admin_event_create(text, text, timestamptz, numeric, int, numeric) to authenticated;
grant execute on function public.admin_events() to authenticated;
grant execute on function public.admin_event_cancel(uuid) to authenticated;
grant execute on function public.events_list() to authenticated;
grant execute on function public.event_register(uuid) to authenticated;
grant execute on function public.event_unregister(uuid) to authenticated;
grant execute on function public.poker_tourney_create(text, numeric, int) to authenticated;

select cron.schedule('evenements-depart', '* * * * *', $$select public._event_tick()$$);
