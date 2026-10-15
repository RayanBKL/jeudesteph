-- ============================================================
-- THE ASHTRAY KING — Migration 007 : les 3 derniers jeux en ligne
-- Bataille de Comptoir (cartes tirées dans la vraie collection), Course Clandestine (le serveur rejoue la course
-- à partir des coups de sprint : impossible de tricher sur le temps) et Ultimate Comptoir (match simulé par le serveur
-- contre l'équipe enregistrée d'un vrai joueur).
-- ============================================================

alter table public.card_catalog add column if not exists cps numeric;
alter table public.card_catalog add column if not exists clk numeric;
alter table public.card_catalog add column if not exists val numeric;

alter table public.matches drop constraint if exists matches_game_check;
alter table public.matches add constraint matches_game_check check (game in ('pbc', 'des421', 'quiz', 'bataille', 'course'));
alter table public.game_invites drop constraint if exists game_invites_game_check;
alter table public.game_invites add constraint game_invites_game_check check (game in ('pbc', 'des421', 'quiz', 'bataille', 'course'));

-- ── Bataille : la main (5 cartes tirées dans la collection enregistrée, complétée par des communes) ──
create or replace function public._deal_hand(p_uid uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare inv jsonb; ids text[]; need int;
begin
  begin
    select (data ->> 'empire_state')::jsonb -> 'inventory' into inv from public.cloud_saves where user_id = p_uid;
  exception when others then inv := null;
  end;
  select coalesce(array_agg(k), '{}') into ids from (
    select e.key as k from jsonb_each_text(coalesce(inv, '{}'::jsonb)) e join public.card_catalog c on c.id = e.key
     where e.value ~ '^[0-9]+$' and e.value::int > 0 and c.cps is not null order by random() limit 5) s;
  need := 5 - coalesce(cardinality(ids), 0);
  if need > 0 then
    ids := ids || coalesce((select array_agg(id) from (select id from public.card_catalog where rarity = 'commune' and cps is not null order by random() limit need) q), '{}');
  end if;
  return public._shuffle_ids(ids);
end;
$$;
revoke all on function public._deal_hand(uuid) from public, anon, authenticated;

-- Résout une manche : c1 / c2 = cartes posées (jamais nulles : une carte au hasard est posée pour qui laisse le temps filer)
create or replace function public._bat_resolve(m public.matches, c1 text, c2 text, st jsonb, sec jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare stat text := st ->> 'stat'; v1 numeric := 0; v2 numeric := 0; res int; s1 int := (st -> 'scores' ->> 0)::int; s2 int := (st -> 'scores' ->> 1)::int;
        h1 jsonb; h2 jsonb; fin boolean := false; win uuid; rnd int := (st ->> 'round')::int; t1 int := (st -> 'timeouts' ->> 0)::int; t2 int := (st -> 'timeouts' ->> 1)::int; reason text := 'score';
begin
  select coalesce(case stat when 'cps' then cps when 'clk' then clk else val end, 0) into v1 from public.card_catalog where id = c1;
  select coalesce(case stat when 'cps' then cps when 'clk' then clk else val end, 0) into v2 from public.card_catalog where id = c2;
  res := case when v1 > v2 then 1 when v2 > v1 then 2 else 0 end;
  if res = 1 then s1 := s1 + 1; elsif res = 2 then s2 := s2 + 1; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into h1 from (select x from jsonb_array_elements_text(sec -> 'hands' -> m.p1::text) with ordinality as t(x, o) order by o) q where x <> c1;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into h2 from (select x from jsonb_array_elements_text(sec -> 'hands' -> m.p2::text) with ordinality as t(x, o) order by o) q where x <> c2;
  sec := jsonb_set(jsonb_set(jsonb_set(sec, '{hands}', jsonb_build_object(m.p1::text, h1, m.p2::text, h2)), '{moves}', '{}'::jsonb), '{x}', 'null'::jsonb) - 'x';
  st := jsonb_set(st, '{scores}', jsonb_build_array(s1, s2));
  st := jsonb_set(st, '{sizes}', jsonb_build_array(jsonb_array_length(h1), jsonb_array_length(h2)));
  st := jsonb_set(st, '{locked}', '[false,false]'::jsonb);
  st := jsonb_set(st, '{last}', jsonb_build_object('cards', jsonb_build_array(c1, c2), 'stat', stat, 'values', jsonb_build_array(v1, v2), 'result', res, 'round', rnd));
  st := jsonb_set(st, '{round}', to_jsonb(rnd + 1));
  st := jsonb_set(st, '{stat}', to_jsonb((array['cps', 'clk', 'val'])[1 + floor(random() * 3)::int]));
  if t1 >= 2 and t2 >= 2 then fin := true; reason := 'abandon';
  elsif t1 >= 2 then fin := true; win := m.p2; reason := 'forfait';
  elsif t2 >= 2 then fin := true; win := m.p1; reason := 'forfait';
  elsif s1 >= 3 or s2 >= 3 or jsonb_array_length(h1) = 0 or jsonb_array_length(h2) = 0 then
    fin := true; win := case when s1 > s2 then m.p1 when s2 > s1 then m.p2 else null end;
  end if;
  update public.match_secrets set data = sec where match_id = m.id;
  update public.matches set state = st, deadline = now() + interval '30 seconds', updated_at = now() where id = m.id;
  if fin then perform public._finish_match(m.id, win, reason); end if;
end;
$$;
revoke all on function public._bat_resolve(public.matches, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.bat_play(p_match uuid, p_idx int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; sec jsonb; st jsonb; hand jsonb; mv jsonb; idx int; c text;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select * into m from public.matches where id = p_match for update;
  if not found or m.game <> 'bataille' or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  if m.status <> 'active' then raise exception 'Match terminé'; end if;
  select data into sec from public.match_secrets where match_id = m.id for update;
  idx := case when uid = m.p1 then 0 else 1 end;
  hand := sec -> 'hands' -> uid::text;
  mv := coalesce(sec -> 'moves', '{}'::jsonb);
  if mv ? uid::text then raise exception 'Tu as déjà posé ta carte'; end if;
  if p_idx is null or p_idx < 0 or p_idx >= jsonb_array_length(hand) then raise exception 'Carte invalide'; end if;
  c := hand ->> p_idx;
  mv := mv || jsonb_build_object(uid::text, c);
  st := jsonb_set(m.state, array['locked', idx::text], 'true'::jsonb);
  st := jsonb_set(st, array['timeouts', idx::text], '0'::jsonb);
  sec := jsonb_set(sec, '{moves}', mv);
  if mv ? m.p1::text and mv ? m.p2::text then
    perform public._bat_resolve(m, mv ->> m.p1::text, mv ->> m.p2::text, st, sec);
  else
    update public.match_secrets set data = sec where match_id = m.id;
    update public.matches set state = st, updated_at = now() where id = m.id;
  end if;
  return public.match_get(m.id);
end;
$$;
revoke all on function public.bat_play(uuid, int) from public, anon, authenticated;
grant execute on function public.bat_play(uuid, int) to authenticated;

-- ── Course : le serveur rejoue la course avec les coups de sprint (60 images/s, pas de bonus de cartes) ──
create or replace function public._race_replay(taps numeric[], dist numeric) returns numeric
language plpgsql immutable as $$
declare
  dt constant numeric := 1.0 / 60; max_speed constant numeric := 44;
  energy numeric := 30; cough numeric := 0; coughing boolean := false; ctimer numeric := 0; speed numeric := 0; d numeric := 0; prev numeric;
  green int := 0; ti int := 1; n int := coalesce(cardinality(taps), 0); k int; gain numeric; add numeric;
begin
  for k in 1..(200 * 60) loop
    while ti <= n and taps[ti] < k * dt loop
      if not coughing then
        gain := 25; add := 22;
        if energy >= 10 and energy <= 25 then
          gain := gain * 1.5; add := round(add * 0.4); green := green + 1;
          if green >= 3 then speed := max_speed * 1.3; add := 0; green := 0; end if;
        else green := 0; end if;
        energy := least(100, energy + gain); cough := least(100, cough + add);
      end if;
      ti := ti + 1;
    end loop;
    prev := d;
    if coughing then
      ctimer := ctimer - dt; speed := 0;
      if ctimer <= 0 then coughing := false; cough := greatest(0, cough - 40); end if;
    else
      energy := greatest(0, energy - 5 * dt);
      cough := greatest(0, cough - 8 * dt);
      speed := speed + (energy / 100 * max_speed - speed) * 0.15;
      d := d + speed * 1000 / 3600 * dt;
    end if;
    if cough >= 100 and not coughing then coughing := true; ctimer := 3; speed := 0; green := 0; end if;
    if d >= dist then return (k - 1) * dt + dt * (dist - prev) / nullif(d - prev, 0); end if;
  end loop;
  return null;
end;
$$;
revoke all on function public._race_replay(numeric[], numeric) from public, anon, authenticated;

-- Fin de course : le plus rapide gagne (un abandon ou une cadence inhumaine = aucun temps)
create or replace function public._race_close(m public.matches, st jsonb, p_timeout boolean) returns void
language plpgsql security definer set search_path = public as $$
declare d1 boolean := (st -> 'done' ->> 0)::boolean; d2 boolean := (st -> 'done' ->> 1)::boolean; t1 numeric := (st -> 'times' ->> 0)::numeric; t2 numeric := (st -> 'times' ->> 1)::numeric; win uuid; reason text := 'score';
begin
  if not p_timeout and not (d1 and d2) then
    update public.matches set state = st, updated_at = now() where id = m.id; return;
  end if;
  if t1 is null and t2 is null then
    update public.matches set state = st where id = m.id;
    perform public._finish_match(m.id, null, 'abandon'); return;
  end if;
  if t1 is null then win := m.p2; reason := 'forfait';
  elsif t2 is null then win := m.p1; reason := 'forfait';
  elsif abs(t1 - t2) < 0.02 then win := null;
  else win := case when t1 < t2 then m.p1 else m.p2 end; end if;
  update public.matches set state = st where id = m.id;
  perform public._finish_match(m.id, win, reason);
end;
$$;
revoke all on function public._race_close(public.matches, jsonb, boolean) from public, anon, authenticated;

create or replace function public.race_progress(p_match uuid, p_dist numeric) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; idx int;
begin
  select * into m from public.matches where id = p_match and game = 'course' and status = 'active' and uid in (p1, p2);
  if not found then return; end if;
  idx := case when uid = m.p1 then 0 else 1 end;
  update public.matches set state = jsonb_set(state, array['progress', idx::text], to_jsonb(greatest(0, least(coalesce(p_dist, 0), (state ->> 'distance')::numeric)))) where id = m.id;
end;
$$;
revoke all on function public.race_progress(uuid, numeric) from public, anon, authenticated;
grant execute on function public.race_progress(uuid, numeric) to authenticated;

create or replace function public.race_submit(p_match uuid, p_taps jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; st jsonb; idx int; taps numeric[]; t numeric; n int; sd numeric; startt timestamptz;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select * into m from public.matches where id = p_match for update;
  if not found or m.game <> 'course' or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  if m.status <> 'active' then return public.match_get(p_match); end if;
  st := m.state; idx := case when uid = m.p1 then 0 else 1 end;
  if (st -> 'done' ->> idx)::boolean then return public.match_get(p_match); end if;
  startt := (st ->> 'start_at')::timestamptz;
  if jsonb_typeof(p_taps) <> 'array' or jsonb_array_length(p_taps) > 700 then raise exception 'Coups invalides'; end if;
  select array_agg(x::numeric order by o) into taps from jsonb_array_elements_text(p_taps) with ordinality as q(x, o);
  n := coalesce(cardinality(taps), 0);
  if n > 0 then
    if exists (select 1 from (select x, lag(x) over (order by o) as l from unnest(taps) with ordinality as u(x, o)) z where x < 0 or x > 200 or (l is not null and x - l < 0.05)) then
      t := null;
    elsif n >= 14 then
      select stddev_samp(g) into sd from (select x - lag(x) over (order by o) as g from unnest(taps) with ordinality as u(x, o)) z where g is not null;
      if sd is not null and sd < 0.004 then t := null; else t := public._race_replay(taps, (st ->> 'distance')::numeric); end if;
    else
      t := public._race_replay(taps, (st ->> 'distance')::numeric);
    end if;
  end if;
  -- impossible d'avoir fini plus vite que le temps réel écoulé depuis le départ
  if t is not null and now() < startt + make_interval(secs => t * 0.85) then raise exception 'Course trop rapide : réessaie'; end if;
  st := jsonb_set(st, array['times', idx::text], coalesce(to_jsonb(round(t, 3)), 'null'::jsonb));
  st := jsonb_set(st, array['done', idx::text], 'true'::jsonb);
  perform public._race_close(m, st, false);
  return public.match_get(p_match);
end;
$$;
revoke all on function public.race_submit(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.race_submit(uuid, jsonb) to authenticated;

-- ── Ultimate Comptoir : ton équipe est enregistrée, et tu affrontes celle d'un vrai joueur (simulée par le serveur) ──
create table if not exists public.ut_teams (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  players jsonb not null,
  ev jsonb not null,
  power int not null,
  updated_at timestamptz not null default now()
);
alter table public.ut_teams enable row level security;
revoke all on public.ut_teams from anon, authenticated;
create table if not exists public.ut_matches (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  opp_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists ut_matches_user on public.ut_matches (user_id, opp_id, created_at desc);
alter table public.ut_matches enable row level security;
revoke all on public.ut_matches from anon, authenticated;

create or replace function public._ut_link(a jsonb, b jsonb) returns int language plpgsql immutable as $$
declare club boolean := false; nat boolean := false;
begin
  if coalesce((a ->> 'q')::boolean, false) or coalesce((b ->> 'q')::boolean, false) then return 0; end if;
  select coalesce((a -> 'clubs') ?| (select array_agg(x) from jsonb_array_elements_text(b -> 'clubs') x), false) into club;
  nat := coalesce(a ->> 'nat', '') <> '' and (a ->> 'nat') = (b ->> 'nat');
  return (case when club then 2 else 0 end) + (case when nat then 1 else 0 end);
end;
$$;

-- Même calcul que le jeu (cohésion, puissance par ligne) : p = 11 joueurs dans l'ordre des postes du 4-3-3
create or replace function public._ut_eval(p jsonb) returns jsonb language plpgsql immutable as $$
declare
  slots text[] := array['GB', 'DEF', 'DEF', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT', 'ATT'];
  la int[] := array[0, 0, 1, 2, 3, 1, 2, 2, 3, 3, 4, 5, 6, 5, 6, 7, 8, 9];
  lb int[] := array[2, 3, 2, 3, 4, 5, 5, 6, 6, 7, 7, 6, 7, 8, 9, 10, 9, 10];
  sums numeric[] := array_fill(0::numeric, array[11]); cnt int[] := array_fill(0, array[11]); chem int[] := array_fill(0, array[11]); eff numeric[] := array_fill(0::numeric, array[11]);
  k int; i int; v int; avg numeric; c int; r numeric; ovr_sum numeric := 0; chem_sum int := 0; eff_sum numeric := 0;
  lines jsonb := '{}'::jsonb; pos text; s numeric; n int; ppos text;
begin
  for k in 1..18 loop
    v := public._ut_link(p -> la[k], p -> lb[k]);
    sums[la[k] + 1] := sums[la[k] + 1] + v; cnt[la[k] + 1] := cnt[la[k] + 1] + 1;
    sums[lb[k] + 1] := sums[lb[k] + 1] + v; cnt[lb[k] + 1] := cnt[lb[k] + 1] + 1;
  end loop;
  for i in 1..11 loop
    ppos := p -> (i - 1) ->> 'pos';
    if coalesce((p -> (i - 1) ->> 'q')::boolean, false) then c := 0;
    else
      avg := sums[i] / nullif(cnt[i], 0);
      c := case when avg >= 1.8 then 3 when avg >= 1 then 2 when avg >= 0.4 then 1 else 0 end;
      if ppos <> slots[i] then c := greatest(0, c - 2); end if;
    end if;
    chem[i] := c;
    r := coalesce((p -> (i - 1) ->> 'ovr')::numeric, 50) * (0.85 + 0.05 * c);
    if ppos <> slots[i] then r := r * (case when ppos = 'GB' or slots[i] = 'GB' then 0.6 else 0.9 end); end if;
    eff[i] := r; eff_sum := eff_sum + r; chem_sum := chem_sum + c; ovr_sum := ovr_sum + coalesce((p -> (i - 1) ->> 'ovr')::numeric, 50);
  end loop;
  foreach pos in array array['GB', 'DEF', 'MIL', 'ATT'] loop
    s := 0; n := 0;
    for i in 1..11 loop if slots[i] = pos then s := s + eff[i]; n := n + 1; end if; end loop;
    lines := lines || jsonb_build_object(pos, s / n);
  end loop;
  return jsonb_build_object('ovr', round(ovr_sum / 11), 'cohesion', round(chem_sum / 33.0 * 100), 'lines', lines, 'power', round(eff_sum / 11));
end;
$$;

create or replace function public._ut_sig(x numeric) returns numeric language sql immutable as $$ select 1 / (1 + exp(-x)); $$;

create or replace function public.ut_play(p_squad text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); quartier text[] := array['Kévin du City-Stade', 'Momo Petit-Pont', 'Dédé Grand-Pied', 'Le Neveu du Patron', 'Jojo Tacle-Glissé', 'Bébert Sans-Souffle', 'Sofiane Crochet', 'Le Facteur', 'Titi Pointu', 'Le Cousin de Gégé', 'Rachid Lucarne'];
  slots text[] := array['GB', 'DEF', 'DEF', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT', 'ATT'];
  inv jsonb; players jsonb := '[]'::jsonb; i int; cid text; c public.card_catalog%rowtype; my jsonb; opp public.ut_teams%rowtype; oev jsonb; opp_p jsonb;
  score int[] := array[0, 0]; events jsonb := '[]'::jsonb; mn int; ctrl numeric; side int; att jsonb; def jsonb; chance numeric; pgoal numeric; shooter text; res text; lp jsonb; recent int; atp jsonb; w numeric; x numeric; pn text; popp record;
  mev jsonb;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('ut', 40, 3600);
  if p_squad is null or cardinality(p_squad) <> 11 then raise exception 'Équipe invalide'; end if;
  begin
    select (data ->> 'empire_state')::jsonb -> 'inventory' into inv from public.cloud_saves where user_id = uid;
  exception when others then inv := null;
  end;
  for i in 1..11 loop
    cid := p_squad[i];
    if cid is null or cid = '' then
      players := players || jsonb_build_array(jsonb_build_object('name', quartier[i], 'pos', slots[i], 'ovr', 50, 'nat', '', 'clubs', '[]'::jsonb, 'q', true));
    else
      select * into c from public.card_catalog where card_catalog.id = cid and card_catalog.cat = 'foot' and card_catalog.pos is not null;
      if not found then raise exception 'Footballeur inconnu'; end if;
      if p_squad[1:11] is not null and (select count(*) from unnest(p_squad) z where z = cid) > 1 then raise exception 'Un joueur ne peut être placé qu''une fois'; end if;
      if coalesce((inv ->> cid)::numeric, 0) <= 0 then raise exception 'Une de tes cartes n''est pas encore synchronisée : réessaie dans quelques secondes'; end if;
      players := players || jsonb_build_array(jsonb_build_object('name', c.name, 'pos', c.pos, 'ovr', coalesce(c.ovr, 50), 'nat', coalesce(c.nat, ''), 'clubs', to_jsonb(c.clubs), 'q', false));
    end if;
  end loop;
  my := public._ut_eval(players);
  insert into public.ut_teams as t (user_id, players, ev, power, updated_at) values (uid, players, my, (my ->> 'power')::int, now())
    on conflict (user_id) do update set players = excluded.players, ev = excluded.ev, power = excluded.power, updated_at = now();

  select * into opp from (select * from public.ut_teams where user_id <> uid and updated_at > now() - interval '60 days' order by abs(power - (my ->> 'power')::int) limit 8) n order by random() limit 1;
  if not found then return jsonb_build_object('ok', true, 'no_opponent', true); end if;
  oev := opp.ev; opp_p := opp.players;
  select pseudo, avatar_small into popp from public.profiles where id = opp.user_id;

  for mn in select generate_series(5, 90, 5) loop
    ctrl := public._ut_sig(((my -> 'lines' ->> 'MIL')::numeric - (oev -> 'lines' ->> 'MIL')::numeric) / 8);
    side := case when random() < ctrl then 0 else 1 end;
    if side = 0 then att := my; atp := players; def := oev; else att := oev; atp := opp_p; def := my; end if;
    chance := 0.42 + ((att -> 'lines' ->> 'ATT')::numeric - (def -> 'lines' ->> 'DEF')::numeric) / 60;
    if random() < chance then
      -- tireur choisi selon le poste (attaquants d'abord)
      x := 0; for i in 1..11 loop x := x + case slots[i] when 'ATT' then 5 when 'MIL' then 2 when 'DEF' then 0.6 else 0.02 end; end loop;
      x := random() * x; pn := atp -> 0 ->> 'name';
      for i in 1..11 loop
        x := x - case slots[i] when 'ATT' then 5 when 'MIL' then 2 when 'DEF' then 0.6 else 0.02 end;
        if x <= 0 then pn := atp -> (i - 1) ->> 'name'; exit; end if;
      end loop;
      pgoal := 0.26 * public._ut_sig(((att -> 'lines' ->> 'ATT')::numeric - ((def -> 'lines' ->> 'DEF')::numeric * 0.5 + (def -> 'lines' ->> 'GB')::numeric * 0.5)) / 6) * 1.6;
      if random() < pgoal then
        score[side + 1] := score[side + 1] + 1;
        events := events || jsonb_build_array(jsonb_build_object('m', mn, 't', 'goal', 's', side, 'n', pn));
      else
        events := events || jsonb_build_array(jsonb_build_object('m', mn, 't', 'miss', 's', side, 'n', pn));
      end if;
    elsif random() < 0.35 then
      events := events || jsonb_build_array(jsonb_build_object('m', mn, 't', 'calm', 's', side));
    end if;
  end loop;
  res := case when score[1] > score[2] then 'win' when score[1] < score[2] then 'loss' else 'draw' end;
  select count(*) into recent from public.ut_matches where user_id = uid and opp_id = opp.user_id and created_at > now() - interval '24 hours';
  insert into public.ut_matches (user_id, opp_id) values (uid, opp.user_id);
  if recent < 3 then lp := public._league_apply(uid, 'ut', res, 'pvp'); end if;
  return jsonb_build_object('ok', true, 'no_opponent', false, 'me', my, 'opp', jsonb_build_object('pseudo', popp.pseudo, 'avatar_small', popp.avatar_small, 'ev', oev),
    'score', to_jsonb(score), 'events', events, 'result', res, 'lp', lp);
end;
$$;
revoke all on function public.ut_play(text[]) from public, anon, authenticated;
grant execute on function public.ut_play(text[]) to authenticated;


-- ── Fonctions étendues aux nouveaux jeux ──
create or replace function public._create_match(p_game text, a uuid, b uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare ha text[]; hb text[]; mid uuid; st jsonb; sec jsonb := '{}'::jsonb; q jsonb; qs jsonb := '[]'::jsonb; used text[] := '{}'; i int; dl timestamptz;
begin
  if p_game = 'pbc' then
    st := jsonb_build_object('round', 1, 'scores', '[0,0]'::jsonb, 'locked', '[false,false]'::jsonb, 'timeouts', '[0,0]'::jsonb, 'last', null);
    dl := now() + interval '25 seconds';
  elsif p_game = 'des421' then
    st := jsonb_build_object('round', 1, 'scores', '[0,0]'::jsonb, 'rolls', '[0,0]'::jsonb, 'done', '[false,false]'::jsonb, 'timeouts', '[0,0]'::jsonb, 'last', null);
    dl := now() + interval '45 seconds';
  elsif p_game = 'bataille' then
    ha := public._deal_hand(a); hb := public._deal_hand(b);
    sec := jsonb_build_object('hands', jsonb_build_object(a::text, to_jsonb(ha), b::text, to_jsonb(hb)), 'moves', '{}'::jsonb);
    st := jsonb_build_object('round', 1, 'stat', (array['cps', 'clk', 'val'])[1 + floor(random() * 3)::int], 'scores', '[0,0]'::jsonb,
                             'locked', '[false,false]'::jsonb, 'timeouts', '[0,0]'::jsonb, 'sizes', '[5,5]'::jsonb, 'last', null);
    dl := now() + interval '30 seconds';
  elsif p_game = 'course' then
    st := jsonb_build_object('track', 'trottoir', 'distance', 500, 'start_at', now() + interval '8 seconds',
                             'progress', '[0,0]'::jsonb, 'times', '[null,null]'::jsonb, 'done', '[false,false]'::jsonb);
    sec := jsonb_build_object('taps', '{}'::jsonb);
    dl := now() + interval '8 seconds' + interval '160 seconds';
  else
    for i in 1..10 loop
      q := public._quiz_question(used);
      used := array_append(used, q ->> 'id');
      qs := qs || jsonb_build_array(q);
    end loop;
    sec := jsonb_build_object('questions', qs, 'answers', '{}'::jsonb);
    st := jsonb_build_object('i', 0, 'total', 10, 'scores', '[0,0]'::jsonb, 'answered', '[false,false]'::jsonb, 'timeouts', '[0,0]'::jsonb, 'last', null,
                             'q', (qs -> 0) - 'answer' - 'id', 'started_at', now());
    dl := now() + interval '10 seconds';
  end if;
  insert into public.matches (game, p1, p2, state, deadline) values (p_game, a, b, st, dl) returning id into mid;
  insert into public.match_secrets (match_id, data) values (mid, sec);
  return mid;
end;
$$;

create or replace function public.match_get(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; sec jsonb; mine jsonb := '{}'::jsonb;
begin
  select * into m from public.matches where id = p_match;
  if not found or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  select data into sec from public.match_secrets where match_id = m.id;
  if m.game = 'pbc' then mine := jsonb_build_object('move', sec -> 'moves' -> uid::text);
  elsif m.game = 'des421' then mine := jsonb_build_object('dice', sec -> 'dice' -> uid::text);
  elsif m.game = 'bataille' then mine := jsonb_build_object('hand', sec -> 'hands' -> uid::text, 'move', sec -> 'moves' -> uid::text);
  end if;
  return jsonb_build_object('id', m.id, 'game', m.game, 'status', m.status, 'p1', m.p1, 'p2', m.p2, 'me', case when uid = m.p1 then 0 else 1 end,
    'state', m.state, 'deadline', m.deadline, 'winner', m.winner, 'mine', mine, 'now', now());
end;
$$;

create or replace function public.match_timeout_check(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; sec jsonb; st jsonb; mv jsonb; fin boolean; win uuid; r record; d1 int[]; d2 int[];
        t int[]; k int;
begin
  select * into m from public.matches where id = p_match for update;
  if not found or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  if m.status <> 'active' or m.deadline is null or now() < m.deadline + interval '1 second' then return public.match_get(p_match); end if;
  select data into sec from public.match_secrets where match_id = m.id for update;
  st := m.state;

  if m.game = 'pbc' then
    mv := coalesce(sec -> 'moves', '{}'::jsonb);
    select * into r from public._pbc_resolve(m, mv ->> m.p1::text, mv ->> m.p2::text, st);
    st := r.st; fin := r.finished; win := r.winner;
    update public.matches set state = st, deadline = now() + interval '25 seconds', updated_at = now() where id = m.id;
    update public.match_secrets set data = jsonb_set(sec, '{moves}', '{}'::jsonb) where match_id = m.id;
    if fin then perform public._finish_match(m.id, win, case when (st ->> 'reason_abandon') = 'true' then 'abandon' else 'score' end); end if;

  elsif m.game = 'des421' then
    -- Ceux qui n'ont pas fini : tour terminé avec les dés actuels (aucun dé lancé = on perd la manche)
    for k in 0..1 loop
      if not (st -> 'done' ->> k)::boolean then
        st := jsonb_set(st, array['done', k::text], 'true'::jsonb);
        st := jsonb_set(st, array['timeouts', k::text], to_jsonb((st -> 'timeouts' ->> k)::int + 1));
      end if;
    end loop;
    perform public._d421_after(m, st, sec);

  elsif m.game = 'bataille' then
    declare c1 text; c2 text; t1 int := (st -> 'timeouts' ->> 0)::int; t2 int := (st -> 'timeouts' ->> 1)::int; mv2 jsonb := coalesce(sec -> 'moves', '{}'::jsonb);
    begin
      c1 := mv2 ->> m.p1::text; c2 := mv2 ->> m.p2::text;
      if c1 is null then
        t1 := t1 + 1;
        select x into c1 from jsonb_array_elements_text(sec -> 'hands' -> m.p1::text) x order by random() limit 1;
      else t1 := 0; end if;
      if c2 is null then
        t2 := t2 + 1;
        select x into c2 from jsonb_array_elements_text(sec -> 'hands' -> m.p2::text) x order by random() limit 1;
      else t2 := 0; end if;
      st := jsonb_set(st, '{timeouts}', jsonb_build_array(t1, t2));
      perform public._bat_resolve(m, c1, c2, st, sec);
    end;
  elsif m.game = 'course' then
    perform public._race_close(m, st, true);
  else
    perform public._quiz_advance(m, st, sec);
  end if;
  return public.match_get(p_match);
end;
$$;

create or replace function public.mm_join(p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); other public.matchmaking_queue%rowtype; mid uuid;
begin
  perform public._rl('mm', 200, 60);
  if uid is null then raise exception 'Non connecté'; end if;
  if p_game not in ('pbc', 'des421', 'quiz', 'bataille', 'course') then raise exception 'Jeu inconnu'; end if;
  delete from public.matchmaking_queue where joined_at < now() - interval '30 seconds';
  select id into mid from public.matches where status = 'active' and game = p_game and (p1 = uid or p2 = uid) order by created_at desc limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = uid;
    return jsonb_build_object('match_id', mid);
  end if;
  select * into other from public.matchmaking_queue where game = p_game and user_id <> uid order by joined_at limit 1 for update skip locked;
  if found then
    delete from public.matchmaking_queue where user_id in (uid, other.user_id);
    mid := public._create_match(p_game, other.user_id, uid);
    return jsonb_build_object('match_id', mid);
  end if;
  insert into public.matchmaking_queue (user_id, game, joined_at) values (uid, p_game, now())
    on conflict (user_id) do update set game = excluded.game, joined_at = now();
  return jsonb_build_object('waiting', true);
end;
$$;

create or replace function public.invite_send(p_friend uuid, p_game text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); iid uuid;
begin
  perform public._rl('invite', 30, 600);
  if uid is null then raise exception 'Non connecté'; end if;
  if p_game not in ('pbc', 'des421', 'quiz', 'bataille', 'course') then raise exception 'Jeu inconnu'; end if;
  if not public._are_friends(uid, p_friend) then raise exception 'Ce joueur n''est pas dans tes amis'; end if;
  update public.game_invites set status = 'cancelled' where from_user = uid and status = 'pending';
  insert into public.game_invites (from_user, to_user, game) values (uid, p_friend, p_game) returning id into iid;
  return iid;
end;
$$;

revoke all on function public._create_match(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.match_get(uuid) from public, anon, authenticated;
grant execute on function public.match_get(uuid) to authenticated;
revoke all on function public.match_timeout_check(uuid) from public, anon, authenticated;
grant execute on function public.match_timeout_check(uuid) to authenticated;
revoke all on function public.mm_join(text) from public, anon, authenticated;
grant execute on function public.mm_join(text) to authenticated;
revoke all on function public.invite_send(uuid, text) from public, anon, authenticated;
grant execute on function public.invite_send(uuid, text) to authenticated;
