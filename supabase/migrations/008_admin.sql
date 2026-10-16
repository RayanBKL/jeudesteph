-- ============================================================
-- THE ASHTRAY KING — Migration 008 : tableau de bord admin (liste des joueurs, évolution, signalements)
-- Seuls les comptes listés dans admin_users peuvent appeler les fonctions admin_*. Le navigateur n'écrit jamais dans ces tables.
-- ============================================================
create table if not exists public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public._is_admin() returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public._is_admin() from public, anon, authenticated;

-- Le jeu demande seulement « suis-je admin ? » (pour afficher ou non le lien du tableau de bord)
create or replace function public.am_i_admin() returns boolean language sql security definer set search_path = public stable as $$
  select public._is_admin();
$$;
revoke all on function public.am_i_admin() from public, anon, authenticated;
grant execute on function public.am_i_admin() to authenticated;

-- Historique : un relevé par joueur et par jour (conservé, contrairement aux sauvegardes de 7 jours)
create table if not exists public.player_stats_daily (
  day date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  level int, cards int, copies int, cash numeric, clicks numeric, packs numeric, lp int,
  primary key (day, user_id)
);
create table if not exists public.daily_summary (day date primary key, players int, active int, signups int);
alter table public.player_stats_daily enable row level security;
alter table public.daily_summary enable row level security;
revoke all on public.player_stats_daily, public.daily_summary from anon, authenticated;

create or replace function public._jb(t text) returns jsonb language plpgsql immutable as $$
begin return t::jsonb; exception when others then return null; end;
$$;
revoke all on function public._jb(text) from public, anon, authenticated;

create or replace function public._stats_snapshot() returns int language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Paris')::date; n int;
begin
  insert into public.player_stats_daily (day, user_id, level, cards, copies, cash, clicks, packs, lp)
  select d, p.id, coalesce((p.summary ->> 'level')::int, 1), coalesce((p.summary ->> 'cards')::int, 0), coalesce((p.summary ->> 'copies')::int, 0),
         coalesce(((public._jb(s.data ->> 'empire_clicker')) ->> 'cash')::numeric, 0),
         coalesce(((public._jb(s.data ->> 'empire_clicker')) ->> 'totalClicks')::numeric, 0),
         coalesce(((public._jb(s.data ->> 'empire_state')) ->> 'totalPacksOpened')::numeric, 0),
         coalesce((select sum(r.lp) from public.league_ratings r where r.user_id = p.id and r.season = public.current_season()), 0)
    from public.profiles p left join public.cloud_saves s on s.user_id = p.id
  on conflict (day, user_id) do update set level = excluded.level, cards = excluded.cards, copies = excluded.copies, cash = excluded.cash,
    clicks = excluded.clicks, packs = excluded.packs, lp = excluded.lp;
  get diagnostics n = row_count;
  insert into public.daily_summary (day, players, active, signups)
  select d, (select count(*) from public.profiles), (select count(*) from public.profiles where last_seen > now() - interval '24 hours'),
         (select count(*) from public.profiles where created_at > now() - interval '24 hours')
  on conflict (day) do update set players = excluded.players, active = excluded.active, signups = excluded.signups;
  return n;
end;
$$;
revoke all on function public._stats_snapshot() from public, anon, authenticated;

select cron.unschedule('releve-quotidien') where exists (select 1 from cron.job where jobname = 'releve-quotidien');
select cron.schedule('releve-quotidien', '40 1 * * *', 'select public._stats_snapshot()');

-- ── Vue d'ensemble ──
create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  perform public._stats_snapshot();
  select jsonb_build_object(
    'players', (select count(*) from public.profiles),
    'active_24h', (select count(*) from public.profiles where last_seen > now() - interval '24 hours'),
    'active_7d', (select count(*) from public.profiles where last_seen > now() - interval '7 days'),
    'new_24h', (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'flagged', (select count(*) from public.profiles where flagged),
    'matches_total', (select count(*) from public.matches),
    'matches_24h', (select count(*) from public.matches where created_at > now() - interval '24 hours'),
    'in_clan', (select count(*) from public.clan_members),
    'clans', (select count(*) from public.clans),
    'signups', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(g, 'YYYY-MM-DD'), 'n', coalesce(c.n, 0)) order by g)
        from generate_series(current_date - 29, current_date, interval '1 day') g
        left join (select created_at::date as d, count(*) n from public.profiles group by 1) c on c.d = g::date), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(day, 'YYYY-MM-DD'), 'players', players, 'active', active) order by day) from (select * from public.daily_summary order by day desc limit 60) q), '[]'::jsonb),
    'games', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(d, 'YYYY-MM-DD'), 'game', game, 'n', n) order by d) from
        (select created_at::date as d, game, count(*) n from public.league_log where created_at > now() - interval '30 days' group by 1, 2) q), '[]'::jsonb),
    'by_game', coalesce((select jsonb_agg(jsonb_build_object('game', game, 'n', n, 'pvp', pvp)) from (select game, count(*) n, count(*) filter (where mode = 'pvp') pvp from public.league_log group by game) q), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'pseudo', pseudo, 'level', lvl, 'cards', cards)) from
        (select id, pseudo, coalesce((summary ->> 'level')::int, 1) lvl, coalesce((summary ->> 'cards')::int, 0) cards from public.profiles order by lvl desc, cards desc limit 10) q), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;
revoke all on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.admin_overview() to authenticated;

-- ── Liste des joueurs (recherche par pseudo ou e-mail) ──
create or replace function public.admin_players(p_search text default '', p_limit int default 100, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; q text := lower(coalesce(trim(p_search), ''));
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.last_seen desc nulls last), '[]'::jsonb) into r from (
    select p.id, p.pseudo, u.email, p.created_at, p.last_seen, u.last_sign_in_at, u.email_confirmed_at is not null as confirmed,
           coalesce((p.summary ->> 'level')::int, 1) as level, coalesce((p.summary ->> 'cards')::int, 0) as cards, coalesce((p.summary ->> 'copies')::int, 0) as copies,
           coalesce(((public._jb(s.data ->> 'empire_clicker')) ->> 'cash')::numeric, 0) as cash,
           coalesce(((public._jb(s.data ->> 'empire_state')) ->> 'totalPacksOpened')::numeric, 0) as packs,
           coalesce((select sum(lp) from public.league_ratings x where x.user_id = p.id and x.season = public.current_season()), 0) as lp,
           p.flagged, coalesce((select n from public.cheat_flags f where f.user_id = p.id), 0) as flags,
           (select c.name from public.clan_members m join public.clans c on c.id = m.clan_id where m.user_id = p.id) as clan
      from public.profiles p join auth.users u on u.id = p.id left join public.cloud_saves s on s.user_id = p.id
     where q = '' or lower(p.pseudo) like '%' || q || '%' or lower(u.email) like '%' || q || '%'
     order by p.last_seen desc nulls last limit least(p_limit, 500) offset greatest(p_offset, 0)) t;
  return r;
end;
$$;
revoke all on function public.admin_players(text, int, int) from public, anon, authenticated;
grant execute on function public.admin_players(text, int, int) to authenticated;

-- ── Fiche d'un joueur : évolution jour par jour, rangs, dernières parties, signalements ──
create or replace function public.admin_player(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  select jsonb_build_object(
    'id', p.id, 'pseudo', p.pseudo, 'email', u.email, 'created_at', p.created_at, 'last_seen', p.last_seen, 'last_sign_in', u.last_sign_in_at, 'flagged', p.flagged,
    'friend_code', p.friend_code, 'summary', p.summary,
    'friends', (select count(*) from public.friendships f where (f.requester = p.id or f.target = p.id) and f.status = 'accepted'),
    'clan', (select jsonb_build_object('name', c.name, 'tag', c.tag, 'leader', c.leader = p.id) from public.clan_members m join public.clans c on c.id = m.clan_id where m.user_id = p.id),
    'flag_info', (select jsonb_build_object('n', f.n, 'reason', f.last_reason, 'at', f.last_at) from public.cheat_flags f where f.user_id = p.id),
    'history', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(day, 'YYYY-MM-DD'), 'level', level, 'cards', cards, 'copies', copies, 'cash', cash, 'clicks', clicks, 'packs', packs, 'lp', lp) order by day)
        from (select * from public.player_stats_daily where user_id = p.id order by day desc limit 120) q), '[]'::jsonb),
    'ratings', coalesce((select jsonb_agg(jsonb_build_object('game', game, 'season', season, 'lp', lp, 'wins', wins, 'losses', losses, 'draws', draws) order by season desc, game) from public.league_ratings where user_id = p.id), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(jsonb_build_object('at', created_at, 'game', game, 'result', result, 'mode', mode, 'delta', delta) order by created_at desc) from
        (select * from public.league_log where user_id = p.id order by created_at desc limit 30) q), '[]'::jsonb)
  ) into r from public.profiles p join auth.users u on u.id = p.id where p.id = p_id;
  return r;
end;
$$;
revoke all on function public.admin_player(uuid) from public, anon, authenticated;
grant execute on function public.admin_player(uuid) to authenticated;

create or replace function public.admin_set_flag(p_id uuid, p_flagged boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  update public.profiles set flagged = coalesce(p_flagged, false) where id = p_id;
  if not coalesce(p_flagged, false) then delete from public.cheat_flags where user_id = p_id; end if;
end;
$$;
revoke all on function public.admin_set_flag(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_flag(uuid, boolean) to authenticated;
