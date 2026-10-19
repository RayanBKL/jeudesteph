-- ============================================================
-- THE ASHTRAY KING — Migration 022 : récompenses de fin de saison
-- À la fin de chaque saison (30 jours), chaque joueur qui a joué au moins 5 parties classées reçoit :
--   • un « paquet de saison » de 5 cartes avec AU MOINS UNE MYTHIQUE ;
--   • la carte EXCLUSIVE de son meilleur palier (Mégot … Roi du Comptoir), si la série de cette saison existe (cartes « saisonN-… »).
-- Les cartes arrivent par account_grants (kind 'season') : le jeu du joueur les ajoute à sa prochaine synchronisation.
-- ============================================================
update public.card_catalog set quiz_ok = false where cat = 'saison';

create table if not exists public.season_log (
  season text primary key,
  done_at timestamptz not null default now(),
  players int not null default 0
);
alter table public.season_log enable row level security;
revoke all on public.season_log from anon, authenticated;

-- Paquet de saison : 4 cartes tirées selon des chances « premium » + 1 mythique garantie (jamais de carte exclusive de saison)
create or replace function public._season_pack() returns text[] language plpgsql volatile security definer set search_path = public as $$
declare ids text[] := '{}'; i int; r float; rar text; c text;
begin
  for i in 1..4 loop
    r := random();
    rar := case when r < 0.50 then 'commune' when r < 0.78 then 'peu-commune' when r < 0.93 then 'rare' when r < 0.983 then 'epique' when r < 0.997 then 'legendaire' else 'mythique' end;
    select id into c from public.card_catalog where rarity = rar and cat <> 'saison' order by random() limit 1;
    ids := ids || c;
  end loop;
  select id into c from public.card_catalog where rarity = 'mythique' and cat <> 'saison' order by random() limit 1;
  return ids || c;
end;
$$;
revoke all on function public._season_pack() from public, anon, authenticated;

-- Récompenses d'une saison. p_only : un seul joueur (test, rien n'est enregistré dans season_log).
create or replace function public._season_rewards(p_season text, p_only uuid default null) returns int language plpgsql security definer set search_path = public as $$
declare
  slugs text[] := array['megot', 'roulee', 'blonde', 'brune', 'cigarillo', 'havane', 'buraliste', 'baron', 'parrain', 'roi'];
  n int := floor((to_date(p_season, 'YYYY-MM-DD') - date '2026-10-01') / 30.0)::int + 1;
  u record; best int; tier int; excl text; card text; cnt int := 0; note text := 'Récompense de la saison ' || (floor((to_date(p_season, 'YYYY-MM-DD') - date '2026-10-01') / 30.0)::int + 1);
begin
  for u in
    select r.user_id, max(least(25, r.lp / 100)) as idx, sum(r.wins + r.losses + r.draws) as games
      from public.league_ratings r join public.profiles p on p.id = r.user_id
     where r.season = p_season and not p.is_bot and (p_only is null or r.user_id = p_only)
     group by r.user_id having sum(r.wins + r.losses + r.draws) >= 5
  loop
    tier := case when u.idx < 24 then u.idx / 3 else u.idx - 16 end;
    excl := 'saison' || n || '-' || slugs[tier + 1];
    foreach card in array public._season_pack() loop
      insert into public.account_grants (user_id, mode, amount, note, kind, card_id) values (u.user_id, 'add', 0, note || ' : paquet de saison', 'season', card);
    end loop;
    if exists (select 1 from public.card_catalog where id = excl) then
      insert into public.account_grants (user_id, mode, amount, note, kind, card_id) values (u.user_id, 'add', 0, note || ' : carte exclusive', 'season', excl);
    end if;
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
revoke all on function public._season_rewards(text, uuid) from public, anon, authenticated;

-- Chaque nuit : les saisons terminées et pas encore récompensées sont traitées (une seule fois chacune)
create or replace function public._season_close() returns void language plpgsql security definer set search_path = public as $$
declare s text; c int;
begin
  for s in select distinct season from public.league_ratings where season < public.current_season() and season ~ '^\d{4}-\d{2}-\d{2}$' and season not in (select season from public.season_log) order by 1 loop
    c := public._season_rewards(s);
    insert into public.season_log (season, players) values (s, c) on conflict do nothing;
  end loop;
end;
$$;
revoke all on function public._season_close() from public, anon, authenticated;

select cron.unschedule('saison-recompenses') where exists (select 1 from cron.job where jobname = 'saison-recompenses');
select cron.schedule('saison-recompenses', '30 23 * * *', $$select public._season_close()$$);
