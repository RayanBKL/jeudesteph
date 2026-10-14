-- ============================================================
-- THE ASHTRAY KING — Migration 002 : comptes, sauvegarde en ligne, ligues, classements
-- Ajoute des éléments, ne supprime rien (les comptes existants sont conservés).
-- ============================================================

-- ── 1. Profils : avatar, résumé public, pseudo unique (insensible à la casse) ──
alter table public.profiles add column if not exists avatar text check (avatar is null or length(avatar) < 80000);
alter table public.profiles add column if not exists avatar_small text check (avatar_small is null or length(avatar_small) < 12000);
alter table public.profiles add column if not exists summary jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists last_seen timestamptz default now();

create unique index if not exists profiles_pseudo_lower_uq on public.profiles (lower(pseudo));

-- Le navigateur ne peut modifier que son pseudo et sa photo. Argent, niveau, rangs : serveur uniquement.
revoke update on public.profiles from anon, authenticated;
grant update (pseudo, avatar, avatar_small) on public.profiles to authenticated;

-- Pseudo disponible ? (utilisable avant l'inscription)
create or replace function public.pseudo_available(p_pseudo text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where lower(pseudo) = lower(trim(p_pseudo)));
$$;
revoke all on function public.pseudo_available(text) from public, anon, authenticated;
grant execute on function public.pseudo_available(text) to anon, authenticated;

-- Inscription : ne plante plus si le pseudo est déjà pris (on ajoute un numéro)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_pseudo text;
  user_pseudo text;
  gen_code text;
  tries int := 0;
begin
  base_pseudo := left(trim(regexp_replace(coalesce(new.raw_user_meta_data->>'pseudo', ''), '[^[:alnum:] _.''-]', '', 'g')), 20);
  if char_length(base_pseudo) < 2 then
    base_pseudo := 'Joueur' || substr(replace(new.id::text, '-', ''), 1, 5);
  end if;
  user_pseudo := base_pseudo;
  while exists (select 1 from public.profiles where lower(pseudo) = lower(user_pseudo)) and tries < 20 loop
    user_pseudo := left(base_pseudo, 20) || floor(random() * 900 + 100)::int::text;
    tries := tries + 1;
  end loop;

  loop
    gen_code := upper(substr(regexp_replace(user_pseudo, '[^a-zA-Z0-9]', '', 'g') || 'XXXX', 1, 4)) || '-' || lpad((floor(random() * 9000 + 1000)::int)::text, 4, '0');
    exit when not exists (select 1 from public.profiles where friend_code = gen_code);
  end loop;

  insert into public.profiles (id, pseudo, friend_code) values (new.id, user_pseudo, gen_code) on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 2. Sauvegarde en ligne (une ligne par joueur) ──
create table if not exists public.cloud_saves (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null,
  device text,
  updated_at timestamptz not null default now(),
  constraint cloud_saves_size check (octet_length(data::text) < 3000000)
);
alter table public.cloud_saves enable row level security;
drop policy if exists "Sauvegarde lisible par son propriétaire" on public.cloud_saves;
create policy "Sauvegarde lisible par son propriétaire" on public.cloud_saves for select to authenticated using (user_id = auth.uid());
revoke all on public.cloud_saves from anon, authenticated;
grant select on public.cloud_saves to authenticated;

-- Écriture : uniquement par cette fonction (détecte les conflits entre appareils)
create or replace function public.cloud_save_put(p_data jsonb, p_base timestamptz default null, p_device text default null, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur timestamptz;
  ts timestamptz := clock_timestamp();
  clicker jsonb; empire jsonb; prest jsonb;
  cards int := 0; copies int := 0; troph jsonb := '{}'::jsonb; lvl int := 1;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select updated_at into cur from public.cloud_saves where user_id = uid for update;
  if found and not p_force and (p_base is null or cur > p_base) then
    return jsonb_build_object('ok', false, 'conflict', true, 'updated_at', cur);
  end if;

  insert into public.cloud_saves (user_id, data, device, updated_at) values (uid, p_data, p_device, ts)
  on conflict (user_id) do update set data = excluded.data, device = excluded.device, updated_at = excluded.updated_at;

  -- Résumé public (niveau, cartes, trophées) tiré de la sauvegarde
  begin
    clicker := (p_data ->> 'empire_clicker')::jsonb;
    empire := (p_data ->> 'empire_state')::jsonb;
    prest := (p_data ->> 'prestige_v1')::jsonb;
    lvl := coalesce((clicker ->> 'empireLevel')::int, 1);
    select count(*) filter (where value::int > 0), coalesce(sum(value::int) filter (where value::int > 0), 0)
      into cards, copies from jsonb_each_text(coalesce(empire -> 'inventory', '{}'::jsonb));
    select coalesce(jsonb_object_agg(tier, n), '{}'::jsonb) into troph
      from (select t ->> 'tier' as tier, count(*) as n from jsonb_array_elements(coalesce(prest -> 'trophies', '[]'::jsonb)) t group by 1) s;
  exception when others then null;
  end;
  update public.profiles
     set summary = jsonb_build_object('level', lvl, 'cards', cards, 'copies', copies, 'trophies', troph), last_seen = now()
   where id = uid;

  return jsonb_build_object('ok', true, 'updated_at', ts);
end;
$$;
revoke all on function public.cloud_save_put(jsonb, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.cloud_save_put(jsonb, timestamptz, text, boolean) to authenticated;

-- ── 3. Ligues : rangs par jeu et par saison (un mois) ──
create table if not exists public.league_ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('ut', 'bataille', 'des421', 'pbc', 'quiz', 'course')),
  season text not null,
  lp int not null default 0 check (lp >= 0),
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  streak int not null default 0,
  best_lp int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, game, season)
);
create index if not exists league_ratings_board on public.league_ratings (game, season, lp desc);
alter table public.league_ratings enable row level security;
drop policy if exists "Classements lisibles" on public.league_ratings;
create policy "Classements lisibles" on public.league_ratings for select to authenticated using (true);
revoke all on public.league_ratings from anon, authenticated;
grant select on public.league_ratings to authenticated;

create table if not exists public.league_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  season text not null,
  result text not null,
  mode text not null,
  delta int not null,
  lp_after int not null,
  created_at timestamptz not null default now()
);
create index if not exists league_log_user on public.league_log (user_id, game, created_at desc);
alter table public.league_log enable row level security;
revoke all on public.league_log from anon, authenticated;

create or replace function public.current_season() returns text language sql stable as $$
  select to_char(now() at time zone 'Europe/Paris', 'YYYY-MM');
$$;

-- Les rangs 0 à 23 = 8 paliers × 3 divisions, 24 = Parrain, 25 = Roi du Comptoir
create or replace function public._tier_start(idx int) returns int language sql immutable as $$
  select case when idx >= 24 then idx else (idx / 3) * 3 end;
$$;

-- Applique un résultat de partie (interne : appelé par league_record et par les matchs entre joueurs)
create or replace function public._league_apply(p_uid uuid, p_game text, p_result text, p_mode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_season text := public.current_season();
  r public.league_ratings%rowtype;
  prev_lp int;
  before_idx int; after_idx int;
  delta int := 0;
  floor_lp int;
  new_lp int;
  cap_lp int := 2099;   -- contre l'ordi on ne dépasse pas Buraliste I (rang 20) : Baron et plus = vrais joueurs
begin
  select * into r from public.league_ratings where user_id = p_uid and game = p_game and season = v_season for update;
  if not found then
    -- Nouvelle saison : on repart avec 40 % des points de la saison précédente
    select lp into prev_lp from public.league_ratings where user_id = p_uid and game = p_game order by season desc limit 1;
    insert into public.league_ratings (user_id, game, season, lp, best_lp)
      values (p_uid, p_game, v_season, coalesce(prev_lp, 0) * 40 / 100, coalesce(prev_lp, 0) * 40 / 100)
      returning * into r;
  end if;

  before_idx := least(25, r.lp / 100);
  if p_result = 'win' then
    r.wins := r.wins + 1;
    r.streak := case when r.streak > 0 then r.streak + 1 else 1 end;
    delta := round(30 - before_idx * 0.5)::int + least(10, (r.streak - 1) * 3);
    if p_mode = 'pvp' then delta := round(delta * 1.5)::int; end if;
  elsif p_result = 'loss' then
    r.losses := r.losses + 1;
    r.streak := case when r.streak < 0 then r.streak - 1 else -1 end;
    delta := -round(12 + before_idx * 0.6)::int;
    floor_lp := public._tier_start(before_idx) * 100;
    if r.lp + delta < floor_lp then delta := floor_lp - r.lp; end if;
  else
    r.draws := r.draws + 1;
  end if;

  new_lp := greatest(0, r.lp + delta);
  if p_mode <> 'pvp' and new_lp > cap_lp then new_lp := greatest(r.lp, cap_lp); delta := new_lp - r.lp; end if;
  after_idx := least(25, new_lp / 100);

  update public.league_ratings
     set lp = new_lp, wins = r.wins, losses = r.losses, draws = r.draws, streak = r.streak,
         best_lp = greatest(best_lp, new_lp), updated_at = now()
   where user_id = p_uid and game = p_game and season = v_season;
  insert into public.league_log (user_id, game, season, result, mode, delta, lp_after) values (p_uid, p_game, v_season, p_result, p_mode, delta, new_lp);

  return jsonb_build_object('game', p_game, 'season', v_season, 'lp', new_lp, 'delta', delta, 'before', before_idx, 'after', after_idx,
    'wins', r.wins, 'losses', r.losses, 'draws', r.draws, 'streak', r.streak,
    'capped', (p_mode <> 'pvp' and new_lp >= cap_lp));
end;
$$;
revoke all on function public._league_apply(uuid, text, text, text) from public, anon, authenticated;

-- Appelée par le jeu après une partie contre l'ordinateur (limitée en fréquence)
create or replace function public.league_record(p_game text, p_result text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); last_at timestamptz; today int;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if p_game not in ('ut', 'bataille', 'des421', 'pbc', 'quiz', 'course') then raise exception 'Jeu inconnu'; end if;
  if p_result not in ('win', 'loss', 'draw') then raise exception 'Résultat invalide'; end if;
  select max(created_at) into last_at from public.league_log where user_id = uid and game = p_game;
  if last_at is not null and last_at > now() - interval '12 seconds' then raise exception 'Trop rapide : une partie dure plus de 12 secondes.'; end if;
  select count(*) into today from public.league_log where user_id = uid and mode = 'ai' and created_at > now() - interval '24 hours';
  if today >= 200 then raise exception 'Limite de parties classées contre l''ordinateur atteinte pour aujourd''hui.'; end if;
  return public._league_apply(uid, p_game, p_result, 'ai');
end;
$$;
revoke all on function public.league_record(text, text) from public, anon, authenticated;
grant execute on function public.league_record(text, text) to authenticated;

-- Mes rangs (toutes les parties de la saison en cours, avec ma position au classement)
create or replace function public.get_my_ratings()
returns table (game text, season text, lp int, wins int, losses int, draws int, streak int, pos bigint)
language sql security definer set search_path = public stable as $$
  select r.game, r.season, r.lp, r.wins, r.losses, r.draws, r.streak,
         (select count(*) + 1 from public.league_ratings o where o.game = r.game and o.season = r.season and (o.lp > r.lp or (o.lp = r.lp and o.updated_at < r.updated_at)))
    from public.league_ratings r
   where r.user_id = auth.uid() and r.season = public.current_season();
$$;
revoke all on function public.get_my_ratings() from public, anon, authenticated;
grant execute on function public.get_my_ratings() to authenticated;

-- Classement d'un jeu
create or replace function public.get_leaderboard(p_game text, p_season text default null, p_limit int default 50)
returns table (pos bigint, user_id uuid, pseudo text, avatar_small text, lp int, wins int, losses int, level int)
language sql security definer set search_path = public stable as $$
  select row_number() over (order by r.lp desc, r.updated_at asc), r.user_id, p.pseudo, p.avatar_small, r.lp, r.wins, r.losses,
         coalesce((p.summary ->> 'level')::int, 1)
    from public.league_ratings r join public.profiles p on p.id = r.user_id
   where r.game = p_game and r.season = coalesce(p_season, public.current_season())
   order by r.lp desc, r.updated_at asc
   limit least(coalesce(p_limit, 50), 100);
$$;
revoke all on function public.get_leaderboard(text, text, int) from public, anon, authenticated;
grant execute on function public.get_leaderboard(text, text, int) to authenticated;

-- Classement général (somme des points de tous les jeux)
create or replace function public.get_overall_leaderboard(p_season text default null, p_limit int default 50)
returns table (pos bigint, user_id uuid, pseudo text, avatar_small text, lp bigint, games int, level int)
language sql security definer set search_path = public stable as $$
  select row_number() over (order by sum(r.lp) desc), r.user_id, p.pseudo, p.avatar_small, sum(r.lp), count(*)::int, coalesce((p.summary ->> 'level')::int, 1)
    from public.league_ratings r join public.profiles p on p.id = r.user_id
   where r.season = coalesce(p_season, public.current_season())
   group by r.user_id, p.pseudo, p.avatar_small, p.summary
   order by sum(r.lp) desc
   limit least(coalesce(p_limit, 50), 100);
$$;
revoke all on function public.get_overall_leaderboard(text, int) from public, anon, authenticated;
grant execute on function public.get_overall_leaderboard(text, int) to authenticated;

-- Classement des collectionneurs (cartes uniques possédées)
create or replace function public.get_collectors(p_limit int default 50)
returns table (pos bigint, user_id uuid, pseudo text, avatar_small text, cards int, level int)
language sql security definer set search_path = public stable as $$
  select row_number() over (order by coalesce((p.summary ->> 'cards')::int, 0) desc), p.id, p.pseudo, p.avatar_small,
         coalesce((p.summary ->> 'cards')::int, 0), coalesce((p.summary ->> 'level')::int, 1)
    from public.profiles p
   where coalesce((p.summary ->> 'cards')::int, 0) > 0
   order by coalesce((p.summary ->> 'cards')::int, 0) desc
   limit least(coalesce(p_limit, 50), 100);
$$;
revoke all on function public.get_collectors(int) from public, anon, authenticated;
grant execute on function public.get_collectors(int) to authenticated;

-- ── 4. Les profils ne sont visibles que par les joueurs connectés ──
drop policy if exists "Profils publics" on public.profiles;
drop policy if exists "Les profils sont visibles publiquement par les joueurs" on public.profiles;
create policy "Profils visibles par les joueurs connectés" on public.profiles for select to authenticated using (true);
revoke select on public.profiles from anon;
