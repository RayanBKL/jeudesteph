-- ============================================================
-- THE ASHTRAY KING — Migration 004 : durcissement de sécurité (audit du 14/10/2026)
-- ============================================================

-- 1. Pseudo et photos : un format strict, pour qu'aucun joueur ne puisse glisser du code dans la page des autres
alter table public.profiles drop constraint if exists profiles_pseudo_safe;
alter table public.profiles add constraint profiles_pseudo_safe
  check (pseudo !~ '[<>"&`\\{}=;()/\[\]]|[[:cntrl:]]' and pseudo = btrim(pseudo));
alter table public.profiles drop constraint if exists profiles_avatar_format;
alter table public.profiles add constraint profiles_avatar_format
  check (avatar is null or avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$');
alter table public.profiles drop constraint if exists profiles_avatar_small_format;
alter table public.profiles add constraint profiles_avatar_small_format
  check (avatar_small is null or avatar_small ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$');

-- 2. Profils : les autres joueurs voient le pseudo, la photo et le résumé public. Jamais l'argent, l'XP, les talents…
revoke all on public.profiles from anon, authenticated;
grant select (id, pseudo, friend_code, avatar, avatar_small, summary, last_seen, level, created_at) on public.profiles to authenticated;
grant update (pseudo, avatar, avatar_small) on public.profiles to authenticated;

-- 3. Anciennes tables de la première version (plus utilisées par le jeu) : plus aucun accès direct
revoke all on public.market_listings, public.race_history, public.user_inventory from anon, authenticated;

-- 4. Tables du jeu : on retire les droits inutiles (TRUNCATE, TRIGGER, REFERENCES) laissés par défaut
do $$ declare t text; begin
  foreach t in array array['card_catalog', 'cloud_saves', 'league_ratings', 'matches'] loop
    execute format('revoke truncate, trigger, references, insert, update, delete on public.%I from anon, authenticated', t);
    execute format('revoke select on public.%I from anon', t);
  end loop;
end $$;

-- 5. Fonctions internes : invisibles depuis l'extérieur
do $$ declare f text; begin
  foreach f in array array['_clan_leader_gone()', 'handle_new_user()', 'rls_auto_enable()', '_d421_score(int[])', '_pbc_beats(text,text)',
                           '_quiz_points(boolean,numeric)', '_shuffle_ids(text[])', '_tier_start(int)', 'current_season()'] loop
    begin
      execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    exception when others then raise notice 'ignoré % : %', f, sqlerrm;
    end;
  end loop;
end $$;
-- Toute nouvelle fonction est privée tant qu'on ne l'ouvre pas explicitement
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
