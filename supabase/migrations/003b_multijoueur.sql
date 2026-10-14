-- ============================================================
-- THE ASHTRAY KING — Migration 003b : parties entre vrais joueurs
-- Pierre-Briquet-Clope, 421 et Quiz en direct. Toute la logique est ICI (serveur) :
-- les dés sont lancés par le serveur, les coups et les réponses restent secrets
-- tant que les deux joueurs n'ont pas joué, et un joueur absent perd.
-- ============================================================

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('pbc', 'des421', 'quiz')),
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  p1 uuid not null references public.profiles(id) on delete cascade,
  p2 uuid not null references public.profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,     -- visible par les deux joueurs
  deadline timestamptz,
  winner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (p1 <> p2)
);
create index if not exists matches_p1 on public.matches (p1, status);
create index if not exists matches_p2 on public.matches (p2, status);

-- Secrets du match (coups en attente, dés, réponses) : aucune lecture directe possible
create table if not exists public.match_secrets (
  match_id uuid primary key references public.matches(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
);
alter table public.match_secrets enable row level security;
revoke all on public.match_secrets from anon, authenticated;

create table if not exists public.matchmaking_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  game text not null,
  joined_at timestamptz not null default now()
);
alter table public.matchmaking_queue enable row level security;
revoke all on public.matchmaking_queue from anon, authenticated;

alter table public.matches enable row level security;
drop policy if exists "Un match est visible par ses deux joueurs" on public.matches;
create policy "Un match est visible par ses deux joueurs" on public.matches for select to authenticated using (auth.uid() in (p1, p2));
revoke all on public.matches from anon, authenticated;
grant select on public.matches to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
end $$;

-- ── Fin de match : points de ligue pour les deux joueurs (sauf abus : même duo plus de 10 fois par jour) ──
create or replace function public._finish_match(p_id uuid, p_winner uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; n int; r1 jsonb; r2 jsonb; res1 text; res2 text; new_status text := 'finished';
begin
  select * into m from public.matches where id = p_id for update;
  if not found or m.status <> 'active' then return; end if;
  if p_reason = 'abandon' then
    new_status := 'abandoned';
  else
    res1 := case when p_winner is null then 'draw' when p_winner = m.p1 then 'win' else 'loss' end;
    res2 := case when p_winner is null then 'draw' when p_winner = m.p2 then 'win' else 'loss' end;
    select count(*) into n from public.matches
     where status = 'finished' and game = m.game and created_at > now() - interval '24 hours'
       and ((p1 = m.p1 and p2 = m.p2) or (p1 = m.p2 and p2 = m.p1));
    if n < 10 then
      r1 := public._league_apply(m.p1, m.game, res1, 'pvp');
      r2 := public._league_apply(m.p2, m.game, res2, 'pvp');
    end if;
  end if;
  update public.matches
     set status = new_status, winner = p_winner, deadline = null, updated_at = now(),
         state = state || jsonb_build_object('finished', true, 'reason', p_reason, 'lp', jsonb_build_object('p1', r1, 'p2', r2))
   where id = p_id;
end;
$$;
revoke all on function public._finish_match(uuid, uuid, text) from public, anon, authenticated;

-- ── Création d'un match ──
create or replace function public._shuffle_ids(a text[]) returns text[] language sql volatile as $$
  select coalesce(array_agg(x order by random()), '{}') from unnest(a) x;
$$;

create or replace function public._quiz_question(p_used text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare ans public.card_catalog%rowtype; wrong text[]; choices text[]; names jsonb;
begin
  select * into ans from public.card_catalog where quiz_ok and id <> all(p_used) order by random() limit 1;
  select array_agg(id) into wrong from (select id from public.card_catalog where quiz_ok and cat = ans.cat and id <> ans.id and name <> ans.name order by random() limit 3) w;
  choices := public._shuffle_ids(array_append(coalesce(wrong, '{}'), ans.id));
  select jsonb_agg(c.name order by array_position(choices, c.id)) into names from public.card_catalog c where c.id = any(choices);
  return jsonb_build_object('id', ans.id, 'img', ans.img, 'cat', ans.cat, 'choices', names, 'answer', array_position(choices, ans.id) - 1);
end;
$$;
revoke all on function public._quiz_question(text[]) from public, anon, authenticated;

create or replace function public._create_match(p_game text, a uuid, b uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid; st jsonb; sec jsonb := '{}'::jsonb; q jsonb; qs jsonb := '[]'::jsonb; used text[] := '{}'; i int; dl timestamptz;
begin
  if p_game = 'pbc' then
    st := jsonb_build_object('round', 1, 'scores', '[0,0]'::jsonb, 'locked', '[false,false]'::jsonb, 'timeouts', '[0,0]'::jsonb, 'last', null);
    dl := now() + interval '25 seconds';
  elsif p_game = 'des421' then
    st := jsonb_build_object('round', 1, 'scores', '[0,0]'::jsonb, 'rolls', '[0,0]'::jsonb, 'done', '[false,false]'::jsonb, 'timeouts', '[0,0]'::jsonb, 'last', null);
    dl := now() + interval '45 seconds';
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
revoke all on function public._create_match(text, uuid, uuid) from public, anon, authenticated;

-- ── Recherche d'adversaire ──
create or replace function public.mm_join(p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); other public.matchmaking_queue%rowtype; mid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if p_game not in ('pbc', 'des421', 'quiz') then raise exception 'Jeu inconnu'; end if;
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
revoke all on function public.mm_join(text) from public, anon, authenticated;
grant execute on function public.mm_join(text) to authenticated;

create or replace function public.mm_cancel() returns void language sql security definer set search_path = public as $$
  delete from public.matchmaking_queue where user_id = auth.uid();
$$;
revoke all on function public.mm_cancel() from public, anon, authenticated;
grant execute on function public.mm_cancel() to authenticated;

-- ── Lecture d'un match + mes infos privées (dés, coup joué…) ──
create or replace function public.match_get(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; sec jsonb; mine jsonb := '{}'::jsonb;
begin
  select * into m from public.matches where id = p_match;
  if not found or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  select data into sec from public.match_secrets where match_id = m.id;
  if m.game = 'pbc' then mine := jsonb_build_object('move', sec -> 'moves' -> uid::text);
  elsif m.game = 'des421' then mine := jsonb_build_object('dice', sec -> 'dice' -> uid::text);
  end if;
  return jsonb_build_object('id', m.id, 'game', m.game, 'status', m.status, 'p1', m.p1, 'p2', m.p2, 'me', case when uid = m.p1 then 0 else 1 end,
    'state', m.state, 'deadline', m.deadline, 'winner', m.winner, 'mine', mine, 'now', now());
end;
$$;
revoke all on function public.match_get(uuid) from public, anon, authenticated;
grant execute on function public.match_get(uuid) to authenticated;

create or replace function public.my_active_match(p_game text default null)
returns uuid language sql security definer set search_path = public stable as $$
  select id from public.matches where status = 'active' and (p_game is null or game = p_game) and auth.uid() in (p1, p2) order by created_at desc limit 1;
$$;
revoke all on function public.my_active_match(text) from public, anon, authenticated;
grant execute on function public.my_active_match(text) to authenticated;

-- ── Pierre-Briquet-Clope ──
create or replace function public._pbc_beats(a text, b text) returns boolean language sql immutable as $$
  select (a = 'pierre' and b = 'briquet') or (a = 'briquet' and b = 'clope') or (a = 'clope' and b = 'pierre');
$$;

-- Résout une manche : s1/s2 = coups (null = n'a pas joué). Met à jour m.state et renvoie le gagnant du match (ou null)
create or replace function public._pbc_resolve(m public.matches, a text, b text, inout st jsonb, out finished boolean, out winner uuid)
language plpgsql as $$
declare s1 int := (st -> 'scores' ->> 0)::int; s2 int := (st -> 'scores' ->> 1)::int; res int := 0; t1 int; t2 int;
begin
  finished := false; winner := null;
  if a is not null and b is not null then
    if public._pbc_beats(a, b) then res := 1; elsif public._pbc_beats(b, a) then res := 2; end if;
  elsif a is not null then res := 1;
  elsif b is not null then res := 2;
  else res := -1; end if;                                   -- personne n'a joué : manche annulée
  if res = 1 then s1 := s1 + 1; elsif res = 2 then s2 := s2 + 1; end if;
  t1 := (st -> 'timeouts' ->> 0)::int; t2 := (st -> 'timeouts' ->> 1)::int;
  if a is null then t1 := t1 + 1; else t1 := 0; end if;
  if b is null then t2 := t2 + 1; else t2 := 0; end if;
  st := jsonb_set(st, '{scores}', jsonb_build_array(s1, s2));
  st := jsonb_set(st, '{timeouts}', jsonb_build_array(t1, t2));
  st := jsonb_set(st, '{locked}', '[false,false]'::jsonb);
  st := jsonb_set(st, '{last}', jsonb_build_object('moves', jsonb_build_array(a, b), 'result', res, 'round', st -> 'round'));
  if res <> -1 then st := jsonb_set(st, '{round}', to_jsonb((st ->> 'round')::int + 1)); end if;
  if s1 >= 3 then finished := true; winner := m.p1;
  elsif s2 >= 3 then finished := true; winner := m.p2;
  elsif t1 >= 2 and t2 >= 2 then finished := true; winner := null; st := jsonb_set(st, '{reason_abandon}', 'true'::jsonb);
  elsif t1 >= 2 then finished := true; winner := m.p2;
  elsif t2 >= 2 then finished := true; winner := m.p1;
  end if;
end;
$$;
revoke all on function public._pbc_resolve(public.matches, text, text, jsonb) from public, anon, authenticated;

create or replace function public.pbc_move(p_match uuid, p_move text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; sec jsonb; mv jsonb; idx int; fin boolean; win uuid; st jsonb; r record;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if p_move not in ('pierre', 'briquet', 'clope') then raise exception 'Coup invalide'; end if;
  select * into m from public.matches where id = p_match for update;
  if not found or m.game <> 'pbc' or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  if m.status <> 'active' then raise exception 'Match terminé'; end if;
  select data into sec from public.match_secrets where match_id = m.id for update;
  idx := case when uid = m.p1 then 0 else 1 end;
  mv := coalesce(sec -> 'moves', '{}'::jsonb);
  if mv ? uid::text then raise exception 'Tu as déjà joué ce coup'; end if;
  mv := mv || jsonb_build_object(uid::text, p_move);
  st := jsonb_set(m.state, array['locked', idx::text], 'true'::jsonb);

  if mv ? m.p1::text and mv ? m.p2::text then
    select * into r from public._pbc_resolve(m, mv ->> m.p1::text, mv ->> m.p2::text, st);
    st := r.st; fin := r.finished; win := r.winner;
    mv := '{}'::jsonb;
    update public.matches set state = st, deadline = now() + interval '25 seconds', updated_at = now() where id = m.id;
    update public.match_secrets set data = jsonb_set(sec, '{moves}', mv) where match_id = m.id;
    if fin then perform public._finish_match(m.id, win, case when (st ->> 'reason_abandon') = 'true' then 'abandon' else 'score' end); end if;
  else
    update public.matches set state = st, updated_at = now() where id = m.id;
    update public.match_secrets set data = jsonb_set(sec, '{moves}', mv) where match_id = m.id;
  end if;
  return public.match_get(m.id);
end;
$$;
revoke all on function public.pbc_move(uuid, text) from public, anon, authenticated;
grant execute on function public.pbc_move(uuid, text) to authenticated;

-- ── 421 ──
create or replace function public._d421_score(d int[]) returns numeric language plpgsql immutable as $$
declare s int[]; k text;
begin
  if d is null then return -1; end if;
  select array_agg(x order by x desc) into s from unnest(d) x;
  k := s[1]::text || s[2]::text || s[3]::text;
  if k = '421' then return 1000; end if;
  if k = '111' then return 900; end if;
  if s[1] = s[2] and s[2] = s[3] then return 800 + s[1]; end if;
  if s[2] = 1 and s[3] = 1 then return 700 + s[1]; end if;
  if s[1] - s[2] = 1 and s[2] - s[3] = 1 then return 600 + s[1]; end if;
  if k = '221' then return 0; end if;
  return k::numeric / 10;
end;
$$;

create or replace function public._d421_resolve(m public.matches, dice1 int[], dice2 int[], inout st jsonb, out finished boolean, out winner uuid)
language plpgsql as $$
declare w1 int := (st -> 'scores' ->> 0)::int; w2 int := (st -> 'scores' ->> 1)::int; sc1 numeric; sc2 numeric; res int := 0; t1 int; t2 int;
begin
  finished := false; winner := null;
  sc1 := public._d421_score(dice1); sc2 := public._d421_score(dice2);
  if sc1 > sc2 then res := 1; w1 := w1 + 1; elsif sc2 > sc1 then res := 2; w2 := w2 + 1; end if;
  t1 := (st -> 'timeouts' ->> 0)::int; t2 := (st -> 'timeouts' ->> 1)::int;
  st := jsonb_set(st, '{scores}', jsonb_build_array(w1, w2));
  st := jsonb_set(st, '{rolls}', '[0,0]'::jsonb);
  st := jsonb_set(st, '{done}', '[false,false]'::jsonb);
  st := jsonb_set(st, '{last}', jsonb_build_object('dice', jsonb_build_array(to_jsonb(dice1), to_jsonb(dice2)), 'result', res, 'round', st -> 'round'));
  if res <> 0 then st := jsonb_set(st, '{round}', to_jsonb((st ->> 'round')::int + 1)); end if;
  if w1 >= 2 then finished := true; winner := m.p1;
  elsif w2 >= 2 then finished := true; winner := m.p2;
  elsif t1 >= 2 and t2 >= 2 then finished := true; st := jsonb_set(st, '{reason_abandon}', 'true'::jsonb);
  elsif t1 >= 2 then finished := true; winner := m.p2;
  elsif t2 >= 2 then finished := true; winner := m.p1;
  end if;
end;
$$;
revoke all on function public._d421_resolve(public.matches, int[], int[], jsonb) from public, anon, authenticated;

-- Résout si les deux ont fini ; met à jour la base
create or replace function public._d421_after(m public.matches, st jsonb, sec jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r record; d1 int[]; d2 int[]; fin boolean := false; win uuid;
begin
  if (st -> 'done' ->> 0)::boolean and (st -> 'done' ->> 1)::boolean then
    select array_agg(x::int) into d1 from jsonb_array_elements_text(sec -> 'dice' -> m.p1::text) x;
    select array_agg(x::int) into d2 from jsonb_array_elements_text(sec -> 'dice' -> m.p2::text) x;
    select * into r from public._d421_resolve(m, d1, d2, st);
    st := r.st; fin := r.finished; win := r.winner;
    sec := jsonb_set(sec, '{dice}', '{}'::jsonb);
    update public.matches set state = st, deadline = now() + interval '45 seconds', updated_at = now() where id = m.id;
  else
    update public.matches set state = st, updated_at = now() where id = m.id;
  end if;
  update public.match_secrets set data = sec where match_id = m.id;
  if fin then perform public._finish_match(m.id, win, case when (st ->> 'reason_abandon') = 'true' then 'abandon' else 'score' end); end if;
end;
$$;
revoke all on function public._d421_after(public.matches, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.d421_roll(p_match uuid, p_keep boolean[] default '{false,false,false}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; sec jsonb; st jsonb; idx int; rolls int; cur jsonb; nd int[]; i int;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select * into m from public.matches where id = p_match for update;
  if not found or m.game <> 'des421' or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  if m.status <> 'active' then raise exception 'Match terminé'; end if;
  select data into sec from public.match_secrets where match_id = m.id for update;
  idx := case when uid = m.p1 then 0 else 1 end;
  st := m.state;
  if (st -> 'done' ->> idx)::boolean then raise exception 'Tu as déjà fini ce tour'; end if;
  rolls := (st -> 'rolls' ->> idx)::int;
  if rolls >= 3 then raise exception 'Plus de lancers'; end if;
  cur := coalesce(sec -> 'dice' -> uid::text, '[0,0,0]'::jsonb);
  nd := '{0,0,0}';
  for i in 1..3 loop
    if rolls > 0 and coalesce(p_keep[i], false) then nd[i] := (cur ->> (i - 1))::int;
    else nd[i] := 1 + floor(random() * 6)::int; end if;
  end loop;
  rolls := rolls + 1;
  if not (sec ? 'dice') then sec := sec || '{"dice":{}}'::jsonb; end if;
  sec := jsonb_set(sec, array['dice', uid::text], to_jsonb(nd), true);
  st := jsonb_set(st, array['rolls', idx::text], to_jsonb(rolls));
  st := jsonb_set(st, array['timeouts', idx::text], '0'::jsonb);
  if rolls >= 3 then st := jsonb_set(st, array['done', idx::text], 'true'::jsonb); end if;
  perform public._d421_after(m, st, sec);
  return public.match_get(m.id);
end;
$$;
revoke all on function public.d421_roll(uuid, boolean[]) from public, anon, authenticated;
grant execute on function public.d421_roll(uuid, boolean[]) to authenticated;

create or replace function public.d421_stop(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; sec jsonb; st jsonb; idx int;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select * into m from public.matches where id = p_match for update;
  if not found or m.game <> 'des421' or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  if m.status <> 'active' then raise exception 'Match terminé'; end if;
  select data into sec from public.match_secrets where match_id = m.id for update;
  idx := case when uid = m.p1 then 0 else 1 end;
  st := m.state;
  if (st -> 'rolls' ->> idx)::int < 1 then raise exception 'Lance les dés au moins une fois'; end if;
  st := jsonb_set(st, array['done', idx::text], 'true'::jsonb);
  perform public._d421_after(m, st, sec);
  return public.match_get(m.id);
end;
$$;
revoke all on function public.d421_stop(uuid) from public, anon, authenticated;
grant execute on function public.d421_stop(uuid) to authenticated;

-- ── Quiz ──
create or replace function public._quiz_points(correct boolean, secs numeric) returns int language sql immutable as $$
  select case when correct then 100 + round(greatest(0, 10 - secs) / 10 * 50)::int else 0 end;
$$;

-- Passe à la question suivante (ou termine) une fois les deux réponses données ou le temps écoulé
create or replace function public._quiz_advance(m public.matches, st jsonb, sec jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare i int := (st ->> 'i')::int; qn jsonb := sec -> 'questions' -> i; ans jsonb := coalesce(sec -> 'answers' -> i::text, '{}'::jsonb);
        p int[] := '{0,0}'; sc1 int := (st -> 'scores' ->> 0)::int; sc2 int := (st -> 'scores' ->> 1)::int; k int; a jsonb; t1 int; t2 int; fin boolean := false; win uuid;
begin
  for k in 0..1 loop
    a := ans -> (case when k = 0 then m.p1 else m.p2 end)::text;
    if a is not null and (a ->> 'c')::int = (qn ->> 'answer')::int then p[k + 1] := public._quiz_points(true, (a ->> 't')::numeric); end if;
  end loop;
  sc1 := sc1 + p[1]; sc2 := sc2 + p[2];
  t1 := (st -> 'timeouts' ->> 0)::int; t2 := (st -> 'timeouts' ->> 1)::int;
  if ans ? m.p1::text then t1 := 0; else t1 := t1 + 1; end if;
  if ans ? m.p2::text then t2 := 0; else t2 := t2 + 1; end if;
  st := jsonb_set(st, '{scores}', jsonb_build_array(sc1, sc2));
  st := jsonb_set(st, '{timeouts}', jsonb_build_array(t1, t2));
  st := jsonb_set(st, '{answered}', '[false,false]'::jsonb);
  st := jsonb_set(st, '{last}', jsonb_build_object('answer', qn -> 'answer', 'points', jsonb_build_array(p[1], p[2]), 'i', i,
        'choices', jsonb_build_array(ans -> m.p1::text -> 'c', ans -> m.p2::text -> 'c')));
  if t1 >= 3 and t2 >= 3 then fin := true; st := jsonb_set(st, '{reason_abandon}', 'true'::jsonb);
  elsif t1 >= 3 then fin := true; win := m.p2;
  elsif t2 >= 3 then fin := true; win := m.p1;
  elsif i + 1 >= (st ->> 'total')::int then
    fin := true; win := case when sc1 > sc2 then m.p1 when sc2 > sc1 then m.p2 else null end;
  end if;
  if fin then
    update public.matches set state = st, updated_at = now() where id = m.id;
    perform public._finish_match(m.id, win, case when (st ->> 'reason_abandon') = 'true' then 'abandon' else 'score' end);
  else
    st := jsonb_set(st, '{i}', to_jsonb(i + 1));
    st := jsonb_set(st, '{q}', (sec -> 'questions' -> (i + 1)) - 'answer' - 'id');
    st := jsonb_set(st, '{started_at}', to_jsonb(now()));
    update public.matches set state = st, deadline = now() + interval '10 seconds', updated_at = now() where id = m.id;
  end if;
end;
$$;
revoke all on function public._quiz_advance(public.matches, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.quiz_answer(p_match uuid, p_i int, p_choice int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.matches%rowtype; sec jsonb; st jsonb; idx int; secs numeric; ans jsonb;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select * into m from public.matches where id = p_match for update;
  if not found or m.game <> 'quiz' or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  if m.status <> 'active' then raise exception 'Match terminé'; end if;
  st := m.state;
  if (st ->> 'i')::int <> p_i then raise exception 'Question dépassée'; end if;
  select data into sec from public.match_secrets where match_id = m.id for update;
  idx := case when uid = m.p1 then 0 else 1 end;
  if (st -> 'answered' ->> idx)::boolean then raise exception 'Tu as déjà répondu'; end if;
  secs := extract(epoch from (now() - (st ->> 'started_at')::timestamptz));
  if secs > 11 then raise exception 'Trop tard'; end if;
  ans := coalesce(sec -> 'answers' -> p_i::text, '{}'::jsonb) || jsonb_build_object(uid::text, jsonb_build_object('c', p_choice, 't', least(secs, 10)));
  sec := jsonb_set(sec, array['answers', p_i::text], ans, true);
  st := jsonb_set(st, array['answered', idx::text], 'true'::jsonb);
  update public.match_secrets set data = sec where match_id = m.id;
  if ans ? m.p1::text and ans ? m.p2::text then
    perform public._quiz_advance(m, st, sec);
  else
    update public.matches set state = st, updated_at = now() where id = m.id;
  end if;
  return public.match_get(m.id);
end;
$$;
revoke all on function public.quiz_answer(uuid, int, int) from public, anon, authenticated;
grant execute on function public.quiz_answer(uuid, int, int) to authenticated;

-- ── Temps écoulé (appelable par n'importe lequel des deux joueurs) ──
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

  else
    perform public._quiz_advance(m, st, sec);
  end if;
  return public.match_get(p_match);
end;
$$;
revoke all on function public.match_timeout_check(uuid) from public, anon, authenticated;
grant execute on function public.match_timeout_check(uuid) to authenticated;

-- Quitter un match en cours = le perdre
create or replace function public.match_forfeit(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match for update;
  if not found or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  if m.status = 'active' then
    perform public._finish_match(m.id, case when uid = m.p1 then m.p2 else m.p1 end, 'forfait');
  end if;
  return public.match_get(p_match);
end;
$$;
revoke all on function public.match_forfeit(uuid) from public, anon, authenticated;
grant execute on function public.match_forfeit(uuid) to authenticated;
