-- Les bots de la migration 018 n'apparaissent ni dans les chiffres ni dans la liste admin
CREATE OR REPLACE FUNCTION public.admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  perform public._stats_snapshot();
  select jsonb_build_object(
    'players', (select count(*) from public.profiles where not is_bot),
    'active_24h', (select count(*) from public.profiles where last_seen > now() - interval '24 hours' and not is_bot),
    'active_7d', (select count(*) from public.profiles where last_seen > now() - interval '7 days' and not is_bot),
    'new_24h', (select count(*) from public.profiles where created_at > now() - interval '24 hours' and not is_bot),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days' and not is_bot),
    'flagged', (select count(*) from public.profiles where flagged and not is_bot),
    'matches_total', (select count(*) from public.matches),
    'matches_24h', (select count(*) from public.matches where created_at > now() - interval '24 hours'),
    'in_clan', (select count(*) from public.clan_members),
    'clans', (select count(*) from public.clans),
    'signups', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(g, 'YYYY-MM-DD'), 'n', coalesce(c.n, 0)) order by g)
        from generate_series(current_date - 29, current_date, interval '1 day') g
        left join (select created_at::date as d, count(*) n from public.profiles where not is_bot group by 1) c on c.d = g::date), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(day, 'YYYY-MM-DD'), 'players', players, 'active', active) order by day) from (select * from public.daily_summary order by day desc limit 60) q), '[]'::jsonb),
    'games', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(d, 'YYYY-MM-DD'), 'game', game, 'n', n) order by d) from
        (select created_at::date as d, game, count(*) n from public.league_log where created_at > now() - interval '30 days' group by 1, 2) q), '[]'::jsonb),
    'by_game', coalesce((select jsonb_agg(jsonb_build_object('game', game, 'n', n, 'pvp', pvp)) from (select game, count(*) n, count(*) filter (where mode = 'pvp') pvp from public.league_log group by game) q), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'pseudo', pseudo, 'level', lvl, 'cards', cards)) from
        (select id, pseudo, coalesce((summary ->> 'level')::int, 1) lvl, coalesce((summary ->> 'cards')::int, 0) cards from public.profiles where not is_bot order by lvl desc, cards desc limit 10) q), '[]'::jsonb)
  ) into r;
  return r;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_players(p_search text DEFAULT ''::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     where not p.is_bot and (q = '' or lower(p.pseudo) like '%' || q || '%' or lower(u.email) like '%' || q || '%')
     order by p.last_seen desc nulls last limit least(p_limit, 500) offset greatest(p_offset, 0)) t;
  return r;
end;
$function$
;
CREATE OR REPLACE FUNCTION public._stats_snapshot()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date := (now() at time zone 'Europe/Paris')::date; n int;
begin
  insert into public.player_stats_daily (day, user_id, level, cards, copies, cash, clicks, packs, lp)
  select d, p.id, coalesce((p.summary ->> 'level')::int, 1), coalesce((p.summary ->> 'cards')::int, 0), coalesce((p.summary ->> 'copies')::int, 0),
         coalesce(((public._jb(s.data ->> 'empire_clicker')) ->> 'cash')::numeric, 0),
         coalesce(((public._jb(s.data ->> 'empire_clicker')) ->> 'totalClicks')::numeric, 0),
         coalesce(((public._jb(s.data ->> 'empire_state')) ->> 'totalPacksOpened')::numeric, 0),
         coalesce((select sum(r.lp) from public.league_ratings r where r.user_id = p.id and r.season = public.current_season()), 0)
    from public.profiles p left join public.cloud_saves s on s.user_id = p.id where not p.is_bot
  on conflict (day, user_id) do update set level = excluded.level, cards = excluded.cards, copies = excluded.copies, cash = excluded.cash,
    clicks = excluded.clicks, packs = excluded.packs, lp = excluded.lp;
  get diagnostics n = row_count;
  insert into public.daily_summary (day, players, active, signups)
  select d, (select count(*) from public.profiles), (select count(*) from public.profiles where last_seen > now() - interval '24 hours'),
         (select count(*) from public.profiles where created_at > now() - interval '24 hours')
  on conflict (day) do update set players = excluded.players, active = excluded.active, signups = excluded.signups;
  return n;
end;
$function$
;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
revoke all on function public.admin_players(text, integer, integer) from public, anon;
grant execute on function public.admin_players(text, integer, integer) to authenticated;
revoke all on function public._stats_snapshot() from public, anon, authenticated;
