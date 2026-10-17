-- ============================================================
-- THE ASHTRAY KING — Migration 015 : saisons de 30 jours, demandes pour rejoindre un clan fermé, profils publics + vitrine
-- ============================================================

-- ── 1. Saison de 30 jours (la 1re commence le 1er octobre 2026, fuseau Europe/Paris) ──
create or replace function public.current_season() returns text language sql stable as $$
  select to_char(date '2026-10-01' + (floor(((now() at time zone 'Europe/Paris')::date - date '2026-10-01') / 30.0)::int * 30), 'YYYY-MM-DD');
$$;
-- les anciennes lignes « 2026-10 » deviennent la saison qui commence le 2026-10-01
update public.league_ratings set season = '2026-10-01' where season = '2026-10';
update public.league_log set season = '2026-10-01' where season = '2026-10';

create or replace function public.season_info() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'start', public.current_season(),
    'end', to_char(public.current_season()::date + 29, 'YYYY-MM-DD'),
    'number', (floor(((now() at time zone 'Europe/Paris')::date - date '2026-10-01') / 30.0)::int + 1),
    'days_left', (public.current_season()::date + 29) - (now() at time zone 'Europe/Paris')::date + 1);
$$;
revoke all on function public.season_info() from public, anon;
grant execute on function public.season_info() to authenticated;

-- ── 2. Profil : présentation et vitrine de cartes ──
alter table public.profiles add column if not exists bio text not null default '' check (char_length(bio) <= 140);
alter table public.profiles add column if not exists showcase text[] not null default '{}' check (cardinality(showcase) <= 6);

create or replace function public.profile_customize(p_bio text, p_showcase text[]) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b text; inv jsonb; ids text[] := '{}'; cid text;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('profile_custom', 20, 600);
  b := left(btrim(regexp_replace(coalesce(p_bio, ''), '[[:cntrl:]]', ' ', 'g')), 140);
  if cardinality(coalesce(p_showcase, '{}')) > 6 then raise exception 'Maximum 6 cartes dans la vitrine'; end if;
  begin
    select (data ->> 'empire_state')::jsonb -> 'inventory' into inv from public.cloud_saves where user_id = uid;
  exception when others then inv := null;
  end;
  foreach cid in array coalesce(p_showcase, '{}') loop
    if cid = any(ids) then continue; end if;
    if not exists (select 1 from public.card_catalog where id = cid) then raise exception 'Carte inconnue'; end if;
    if coalesce((inv ->> cid)::numeric, 0) < 1 then raise exception 'Tu ne possèdes pas une de ces cartes (ou ta sauvegarde en ligne n''est pas à jour)'; end if;
    ids := ids || cid;
  end loop;
  update public.profiles set bio = b, showcase = ids where id = uid;
end;
$$;
revoke all on function public.profile_customize(text, text[]) from public, anon, authenticated;
grant execute on function public.profile_customize(text, text[]) to authenticated;

-- Profil public d'un joueur (ce que les autres ont le droit de voir)
create or replace function public.player_profile(p_id uuid) returns jsonb language plpgsql security definer set search_path = public stable as $$
declare uid uuid := auth.uid(); r jsonb; rel text := 'aucune'; f public.friendships%rowtype;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if p_id = uid then rel := 'self';
  else
    select * into f from public.friendships where least(requester, target) = least(uid, p_id) and greatest(requester, target) = greatest(uid, p_id);
    if found then rel := case when f.status = 'accepted' then 'ami' when f.requester = uid then 'envoyee' else 'recue' end; end if;
  end if;
  select jsonb_build_object(
    'id', p.id, 'pseudo', p.pseudo, 'avatar', coalesce(p.avatar, p.avatar_small), 'friend_code', p.friend_code,
    'level', coalesce((p.summary ->> 'level')::int, 1), 'cards', coalesce((p.summary ->> 'cards')::int, 0),
    'online', p.last_seen > now() - interval '90 seconds', 'since', p.created_at, 'bio', p.bio, 'showcase', to_jsonb(p.showcase),
    'rel', rel,
    'clan', (select jsonb_build_object('name', c.name, 'tag', c.tag) from public.clan_members m join public.clans c on c.id = m.clan_id where m.user_id = p.id),
    'ratings', coalesce((select jsonb_agg(jsonb_build_object('game', game, 'lp', lp, 'wins', wins, 'losses', losses) order by game) from public.league_ratings where user_id = p.id and season = public.current_season()), '[]'::jsonb)
  ) into r from public.profiles p where p.id = p_id;
  if r is null then raise exception 'Joueur introuvable'; end if;
  return r;
end;
$$;
revoke all on function public.player_profile(uuid) from public, anon, authenticated;
grant execute on function public.player_profile(uuid) to authenticated;

-- ── 3. Clans fermés : demandes d'adhésion ──
create table if not exists public.clan_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  clan_id uuid not null references public.clans(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, clan_id)
);
alter table public.clan_requests enable row level security;
revoke all on public.clan_requests from anon, authenticated;

create or replace function public.clan_request(p_clan uuid) returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.clans%rowtype;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('clan_request', 20, 3600);
  if exists (select 1 from public.clan_members where user_id = uid) then raise exception 'Tu es déjà dans un clan'; end if;
  select * into c from public.clans where id = p_clan;
  if not found then raise exception 'Clan introuvable'; end if;
  if (select count(*) from public.clan_requests where user_id = uid) >= 5 then raise exception 'Déjà 5 demandes en attente : annule-en une'; end if;
  insert into public.clan_requests (user_id, clan_id) values (uid, p_clan) on conflict do nothing;
  return 'envoyee';
end;
$$;
revoke all on function public.clan_request(uuid) from public, anon, authenticated;
grant execute on function public.clan_request(uuid) to authenticated;

create or replace function public.clan_request_cancel(p_clan uuid) returns void language sql security definer set search_path = public as $$
  delete from public.clan_requests where user_id = auth.uid() and clan_id = p_clan;
$$;
revoke all on function public.clan_request_cancel(uuid) from public, anon, authenticated;
grant execute on function public.clan_request_cancel(uuid) to authenticated;

create or replace function public.clan_requests_list() returns jsonb language plpgsql security definer set search_path = public stable as $$
declare r jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'pseudo', p.pseudo, 'avatar_small', p.avatar_small, 'level', coalesce((p.summary ->> 'level')::int, 1), 'at', q.created_at) order by q.created_at), '[]'::jsonb) into r
    from public.clan_requests q join public.clans c on c.id = q.clan_id and c.leader = auth.uid() join public.profiles p on p.id = q.user_id;
  return r;
end;
$$;
revoke all on function public.clan_requests_list() from public, anon, authenticated;
grant execute on function public.clan_requests_list() to authenticated;

create or replace function public.clan_respond(p_user uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare c public.clans%rowtype;
begin
  select * into c from public.clans where leader = auth.uid();
  if not found then raise exception 'Tu n''es chef d''aucun clan'; end if;
  if not exists (select 1 from public.clan_requests where user_id = p_user and clan_id = c.id) then raise exception 'Demande introuvable'; end if;
  if p_accept then
    if exists (select 1 from public.clan_members where user_id = p_user) then
      delete from public.clan_requests where user_id = p_user; raise exception 'Ce joueur a déjà rejoint un autre clan';
    end if;
    if (select count(*) from public.clan_members where clan_id = c.id) >= 30 then raise exception 'Clan complet (30 membres)'; end if;
    insert into public.clan_members (user_id, clan_id) values (p_user, c.id);
    delete from public.clan_requests where user_id = p_user;       -- ses autres demandes tombent
  else
    delete from public.clan_requests where user_id = p_user and clan_id = c.id;
  end if;
end;
$$;
revoke all on function public.clan_respond(uuid, boolean) from public, anon, authenticated;
grant execute on function public.clan_respond(uuid, boolean) to authenticated;

-- Recherche : indique si j'ai déjà demandé à rejoindre
drop function if exists public.clan_search(text);
create or replace function public.clan_search(p_q text default '')
returns table (id uuid, name text, tag text, descr text, open boolean, members int, lp bigint, pos bigint, requested boolean)
language sql security definer set search_path = public stable as $$
  with t as (
    select c.id, c.name, c.tag, c.descr, c.open,
           (select count(*)::int from public.clan_members m where m.clan_id = c.id) as members,
           coalesce((select sum(r.lp) from public.clan_members m join public.league_ratings r on r.user_id = m.user_id and r.season = public.current_season() where m.clan_id = c.id), 0) as lp
      from public.clans c)
  select t.id, t.name, t.tag, t.descr, t.open, t.members, t.lp, row_number() over (order by t.lp desc, t.members desc),
         exists (select 1 from public.clan_requests q where q.clan_id = t.id and q.user_id = auth.uid())
    from t
   where coalesce(p_q, '') = '' or t.name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%' or t.tag = upper(p_q)
   order by t.lp desc, t.members desc limit 30;
$$;
revoke all on function public.clan_search(text) from public, anon, authenticated;
grant execute on function public.clan_search(text) to authenticated;

-- clan_mine : ajoute le nombre de demandes en attente (visible du chef)
create or replace function public.clan_mine()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare uid uuid := auth.uid(); c public.clans%rowtype; mem jsonb;
begin
  select cl.* into c from public.clans cl join public.clan_members m on m.clan_id = cl.id where m.user_id = uid;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'pseudo', p.pseudo, 'avatar_small', p.avatar_small, 'level', coalesce((p.summary ->> 'level')::int, 1),
           'lp', coalesce((select sum(r.lp) from public.league_ratings r where r.user_id = p.id and r.season = public.current_season()), 0),
           'online', p.last_seen > now() - interval '90 seconds', 'leader', p.id = c.leader)
           order by (p.id = c.leader) desc, coalesce((select sum(r.lp) from public.league_ratings r where r.user_id = p.id and r.season = public.current_season()), 0) desc), '[]'::jsonb)
    into mem from public.clan_members m join public.profiles p on p.id = m.user_id where m.clan_id = c.id;
  return jsonb_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'descr', c.descr, 'open', c.open, 'leader', c.leader, 'me_leader', c.leader = uid,
    'members', mem, 'rank', (select s.pos from public.clan_search('') s where s.id = c.id),
    'requests', case when c.leader = uid then (select count(*) from public.clan_requests q where q.clan_id = c.id) else 0 end);
end;
$$;
revoke all on function public.clan_mine() from public, anon, authenticated;
grant execute on function public.clan_mine() to authenticated;

-- Rejoindre un clan (ouvert) supprime les demandes en attente du joueur
create or replace function public.clan_join(p_clan uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.clans%rowtype;
begin
  if exists (select 1 from public.clan_members where user_id = uid) then raise exception 'Tu es déjà dans un clan'; end if;
  select * into c from public.clans where id = p_clan for update;
  if not found then raise exception 'Clan introuvable'; end if;
  if not c.open then raise exception 'Ce clan est fermé : fais une demande'; end if;
  if (select count(*) from public.clan_members where clan_id = c.id) >= 30 then raise exception 'Clan complet (30 membres)'; end if;
  insert into public.clan_members (user_id, clan_id) values (uid, c.id);
  delete from public.clan_requests where user_id = uid;
end;
$$;
revoke all on function public.clan_join(uuid) from public, anon, authenticated;
grant execute on function public.clan_join(uuid) to authenticated;
