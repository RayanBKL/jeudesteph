-- ============================================================
-- THE ASHTRAY KING — Migration 006 : sauvegarde automatique chaque nuit (gardée 7 jours)
-- Une copie datée des tables importantes est faite dans le schéma « backups » (invisible depuis le jeu).
-- Pour restaurer : create table ... as select * from backups.cloud_saves_AAAAMMJJ (voir README_SAUVEGARDE dans RECAP.md).
-- ============================================================
create extension if not exists pg_cron;

create schema if not exists backups;
revoke all on schema backups from public, anon, authenticated;

create or replace function backups.snapshot() returns text
language plpgsql security definer set search_path = public, backups as $$
declare
  tag text := to_char(now() at time zone 'Europe/Paris', 'YYYYMMDD');
  limit_tag text := to_char((now() at time zone 'Europe/Paris') - interval '7 days', 'YYYYMMDD');
  t text; r record; made int := 0;
begin
  -- garde-fou : au-delà de 150 Mo de sauvegardes en ligne, on ne double pas la base (passer par les sauvegardes Supabase Pro)
  if pg_total_relation_size('public.cloud_saves') > 150 * 1024 * 1024 then
    return 'ignoré : trop volumineux';
  end if;
  foreach t in array array['profiles', 'cloud_saves', 'league_ratings', 'league_log', 'clans', 'clan_members', 'friendships', 'cheat_flags'] loop
    execute format('drop table if exists backups.%I', t || '_' || tag);
    execute format('create table backups.%I as select * from public.%I', t || '_' || tag, t);
    execute format('alter table backups.%I enable row level security', t || '_' || tag);
    made := made + 1;
  end loop;
  for r in select tablename from pg_tables where schemaname = 'backups' and right(tablename, 8) ~ '^[0-9]{8}$' and right(tablename, 8) < limit_tag loop
    execute format('drop table backups.%I', r.tablename);
  end loop;
  return made || ' tables copiées (' || tag || ')';
end;
$$;
revoke all on function backups.snapshot() from public, anon, authenticated;

select cron.unschedule('snapshot-quotidien') where exists (select 1 from cron.job where jobname = 'snapshot-quotidien');
select cron.schedule('snapshot-quotidien', '30 1 * * *', 'select backups.snapshot()');
