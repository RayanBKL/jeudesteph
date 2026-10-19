-- ============================================================
-- THE ASHTRAY KING — Migration 025 : tournois de poker (Sit & Go) avec cagnotte et classement
-- Un joueur crée un tournoi (droit d'entrée, 3 à 6 joueurs). Quand il est complet, il démarre : 1 500 jetons chacun, blindes qui montent toutes
-- les 2 minutes, pas de recave. La cagnotte (somme des droits d'entrée) est redistribuée : 3 joueurs 70/30, 4 à 6 joueurs 50/30/20.
-- Les droits d'entrée passent par des crédits (account_grants kind 'poker') comme les mises de départ des tables classiques.
-- ============================================================
alter table public.poker_tables add column if not exists kind text not null default 'cash';
alter table public.poker_tables drop constraint if exists poker_tables_kind_check;
alter table public.poker_tables add constraint poker_tables_kind_check check (kind in ('cash', 'tournoi'));
alter table public.poker_tables add column if not exists tourney jsonb;

create table if not exists public.tourney_results (
  id bigserial primary key,
  table_id uuid,
  user_id uuid not null references public.profiles(id) on delete cascade,
  place int not null,
  players int not null,
  fee numeric not null,
  prize numeric not null default 0,
  season text not null default public.current_season(),
  created_at timestamptz not null default now()
);
create index if not exists tourney_results_season on public.tourney_results (season, user_id);
alter table public.tourney_results enable row level security;
revoke all on public.tourney_results from anon, authenticated;

-- Un joueur est éliminé : sa place est notée
create or replace function public._pk_tourney_record(tid uuid, uid uuid, place int) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.poker_tables set tourney = jsonb_set(tourney, '{places}', coalesce(tourney -> 'places', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('uid', uid, 'place', place, 'pseudo', (select pseudo from public.profiles where id = uid))))
   where id = tid;
end;
$$;
revoke all on function public._pk_tourney_record(uuid, uuid, int) from public, anon, authenticated;

-- Fin du tournoi : le dernier joueur gagne, la cagnotte est distribuée, le classement est enregistré
create or replace function public._pk_tourney_finish(tid uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.poker_tables%rowtype; tr jsonb; pool numeric; n int; pct numeric[]; w record; places jsonb; p jsonb; pr numeric; paid numeric := 0; fee numeric; i int;
begin
  select * into t from public.poker_tables where id = tid for update;
  tr := t.tourney;
  if tr is null or tr ->> 'status' = 'done' then return; end if;
  for w in select user_id from public.poker_seats where table_id = tid order by stack desc limit 1 loop
    perform public._pk_tourney_record(tid, w.user_id, 1);
  end loop;
  select * into t from public.poker_tables where id = tid;
  tr := t.tourney; places := coalesce(tr -> 'places', '[]'::jsonb);
  pool := (tr ->> 'pool')::numeric; fee := (tr ->> 'fee')::numeric; n := jsonb_array_length(coalesce(tr -> 'players', '[]'::jsonb));
  pct := case when n <= 3 then array[0.7, 0.3] else array[0.5, 0.3, 0.2] end;
  places := (select coalesce(jsonb_agg(x order by (x ->> 'place')::int), '[]'::jsonb) from jsonb_array_elements(places) x);
  for p in select * from jsonb_array_elements(places) loop
    i := (p ->> 'place')::int;
    pr := case when i <= cardinality(pct) then floor(pool * pct[i]) else 0 end;
    if i = 1 then pr := pool - (select coalesce(sum(floor(pool * pct[g])), 0) from generate_series(2, cardinality(pct)) g); end if;
    paid := paid + pr;
    if pr > 0 then perform public._pk_grant((p ->> 'uid')::uuid, pr, 'Tournoi de poker : place ' || i || ' sur ' || n || ', cagnotte +' || pr || ' €'); end if;
    insert into public.tourney_results (table_id, user_id, place, players, fee, prize) values (tid, (p ->> 'uid')::uuid, i, n, fee, pr);
    places := jsonb_set(places, array[(i - 1)::text], (p || jsonb_build_object('prize', pr)));
  end loop;
  delete from public.poker_seats where table_id = tid;
  update public.poker_tables set hand = null, next_hand_at = null, last_activity = now(), tourney = jsonb_set(jsonb_set(tr, '{status}', '"done"'), '{places}', places) where id = tid;
end;
$$;
revoke all on function public._pk_tourney_finish(uuid) from public, anon, authenticated;

create or replace function public._pk_tourney_start(tid uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.poker_tables%rowtype; cnt int; plist jsonb;
begin
  select * into t from public.poker_tables where id = tid for update;
  select count(*), jsonb_agg(jsonb_build_object('uid', s.user_id, 'pseudo', p.pseudo)) into cnt, plist from public.poker_seats s join public.profiles p on p.id = s.user_id where s.table_id = tid;
  update public.poker_tables set sb = 10, bb = 20, next_hand_at = now() + interval '4 seconds', last_activity = now(),
    tourney = t.tourney || jsonb_build_object('status', 'running', 'started_at', now(), 'level', 1, 'players', plist, 'pool', (t.tourney ->> 'fee')::numeric * cnt, 'places', '[]'::jsonb)
   where id = tid;
end;
$$;
revoke all on function public._pk_tourney_start(uuid) from public, anon, authenticated;

create or replace function public.poker_tourney_create(p_name text, p_fee numeric, p_max int) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); tid uuid; nm text; f numeric := round(p_fee);
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('poker_create', 6, 600);
  if f not in (1000, 5000, 20000, 100000) then raise exception 'Droit d''entrée non autorisé'; end if;
  if p_max not in (3, 4, 6) then raise exception 'Nombre de joueurs non autorisé'; end if;
  if exists (select 1 from public.poker_seats where user_id = uid) then raise exception 'Tu es déjà assis à une table : quitte-la d''abord'; end if;
  nm := left(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ''.,!?éèêëàâäîïôöùûüçÉÈÀÇ-]', '', 'g')), 24);
  if char_length(nm) < 2 then nm := 'Tournoi de ' || (select pseudo from public.profiles where id = uid); end if;
  if public._pk_cash(uid) < f then raise exception 'Pas assez d''argent pour ce droit d''entrée (sauvegarde en ligne à jour ?)'; end if;
  insert into public.poker_tables (owner, name, buyin, sb, bb, max_seats, kind, tourney)
    values (uid, nm, f, 10, 20, p_max, 'tournoi', jsonb_build_object('status', 'registering', 'fee', f, 'max', p_max, 'chips', 1500, 'pool', f, 'level', 1, 'places', '[]'::jsonb)) returning id into tid;
  insert into public.poker_secrets (table_id) values (tid);
  insert into public.poker_seats (table_id, seat, user_id, stack) values (tid, 1, uid, 1500);
  perform public._pk_grant(uid, -f, 'Tournoi de poker : droit d''entrée');
  return tid;
end;
$$;
revoke all on function public.poker_tourney_create(text, numeric, int) from public, anon, authenticated;
grant execute on function public.poker_tourney_create(text, numeric, int) to authenticated;

create or replace function public._pk_start_hand(tid uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  t public.poker_tables%rowtype; seats int[]; n int; lvl int; remaining int; sbl int[] := array[10,20,30,50,75,100,150,250,400,600,1000,2000]; dealer int; prevd int; h jsonb; dk jsonb; hol jsonb := '{}'::jsonb; s int; i int; sbseat int; bbseat int; sbamt numeric; bbamt numeric; stk numeric; pl jsonb := '{}'::jsonb; r record;
  suits text[] := array['s','h','d','c']; ranks text[] := array['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
begin
  select * into t from public.poker_tables where id = tid for update;
  if t.kind = 'tournoi' then
    if coalesce(t.tourney ->> 'status', '') <> 'running' then return; end if;
    -- éliminés : plus de jetons ou absent 3 fois de suite. Place = nombre de joueurs encore en lice (les plus grosses mises de la dernière main finissent devant)
    select count(*) into remaining from public.poker_seats where table_id = tid;
    for r in select seat, user_id from public.poker_seats where table_id = tid and (stack <= 0 or timeouts >= 3)
             order by coalesce((t.hand -> 'players' -> seat::text ->> 'total')::numeric, 0) desc, seat loop
      perform public._pk_tourney_record(tid, r.user_id, remaining);
      remaining := remaining - 1;
      delete from public.poker_seats where table_id = tid and seat = r.seat;
    end loop;
    if remaining <= 1 then perform public._pk_tourney_finish(tid); return; end if;
    -- niveau de blindes : +1 toutes les 2 minutes
    lvl := least(cardinality(sbl), 1 + floor(extract(epoch from (now() - (t.tourney ->> 'started_at')::timestamptz)) / 120)::int);
    update public.poker_tables set sb = sbl[lvl], bb = sbl[lvl] * 2, tourney = jsonb_set(tourney, '{level}', to_jsonb(lvl)) where id = tid;
    select * into t from public.poker_tables where id = tid;
  else
    -- les joueurs absents (3 temps morts de suite) quittent la table avec leurs jetons
    for r in select seat, user_id, stack from public.poker_seats where table_id = tid and timeouts >= 3 loop
      if r.stack > 0 then perform public._pk_grant(r.user_id, r.stack, 'Poker : tu as quitté la table (absent), tes jetons te reviennent'); end if;
      delete from public.poker_seats where table_id = tid and seat = r.seat;
    end loop;
    delete from public.poker_seats where table_id = tid and stack <= 0;
  end if;
  select array_agg(seat order by seat) into seats from public.poker_seats where table_id = tid;
  n := coalesce(cardinality(seats), 0);
  if n < 2 then update public.poker_tables set hand = null, next_hand_at = null where id = tid; return; end if;

  prevd := coalesce((t.hand ->> 'dealer')::int, 0);
  select min(x) into dealer from unnest(seats) x where x > prevd;
  dealer := coalesce(dealer, seats[1]);

  select jsonb_agg(rk || su order by random()) into dk from unnest(ranks) rk, unnest(suits) su;
  insert into public.poker_secrets (table_id, deck, holes) values (tid, dk, '{}'::jsonb) on conflict (table_id) do update set deck = excluded.deck, holes = '{}'::jsonb;
  foreach s in array seats loop
    hol := hol || jsonb_build_object(s::text, public._pk_cards(tid, 2));
    pl := pl || jsonb_build_object(s::text, jsonb_build_object('uid', (select user_id from public.poker_seats where table_id = tid and seat = s),
            'bet', 0, 'total', 0, 'folded', false, 'allin', false, 'acted', false));
  end loop;
  update public.poker_secrets set holes = hol where table_id = tid;

  if n = 2 then sbseat := dealer; select min(x) into bbseat from unnest(seats) x where x <> dealer;
  else
    select min(x) into sbseat from unnest(seats) x where x > dealer; sbseat := coalesce(sbseat, seats[1]);
    select min(x) into bbseat from unnest(seats) x where x > sbseat; bbseat := coalesce(bbseat, seats[1]);
  end if;
  h := jsonb_build_object('no', t.hand_no + 1, 'phase', 'preflop', 'dealer', dealer, 'board', '[]'::jsonb, 'players', pl, 'order', to_jsonb(seats),
                          'cur', 0, 'minraise', t.bb, 'ptr', bbseat, 'to_act', null, 'pot', 0, 'result', null);
  -- blindes
  select stack into stk from public.poker_seats where table_id = tid and seat = sbseat;
  sbamt := least(stk, t.sb);
  update public.poker_seats set stack = stack - sbamt where table_id = tid and seat = sbseat;
  h := public._pk_set(public._pk_set(public._pk_set(h, sbseat, 'bet', to_jsonb(sbamt)), sbseat, 'total', to_jsonb(sbamt)), sbseat, 'allin', to_jsonb(stk - sbamt <= 0));
  select stack into stk from public.poker_seats where table_id = tid and seat = bbseat;
  bbamt := least(stk, t.bb);
  update public.poker_seats set stack = stack - bbamt where table_id = tid and seat = bbseat;
  h := public._pk_set(public._pk_set(public._pk_set(h, bbseat, 'bet', to_jsonb(bbamt)), bbseat, 'total', to_jsonb(bbamt)), bbseat, 'allin', to_jsonb(stk - bbamt <= 0));
  h := jsonb_set(h, '{cur}', to_jsonb(greatest(sbamt, bbamt)));
  update public.poker_tables set hand_no = t.hand_no + 1, next_hand_at = null, last_activity = now() where id = tid;
  perform public._pk_advance(tid, h);
end;
$$;

revoke all on function public._pk_start_hand(uuid) from public, anon, authenticated;

create or replace function public.poker_join(p_table uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t public.poker_tables%rowtype; sn int; n int; chips numeric;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('poker_join', 20, 600);
  select * into t from public.poker_tables where id = p_table for update;
  if not found then raise exception 'Table introuvable'; end if;
  if exists (select 1 from public.poker_seats where user_id = uid) then raise exception 'Tu es déjà assis à une table'; end if;
  if t.kind = 'tournoi' and coalesce(t.tourney ->> 'status', '') <> 'registering' then raise exception 'Ce tournoi a déjà commencé'; end if;
  sn := public._pk_free_seat(p_table);
  if sn is null then raise exception 'Table complète'; end if;
  if public._pk_cash(uid) < t.buyin then raise exception 'Pas assez d''argent pour cette mise (sauvegarde en ligne à jour ?)'; end if;
  chips := case when t.kind = 'tournoi' then (t.tourney ->> 'chips')::numeric else t.buyin end;
  insert into public.poker_seats (table_id, seat, user_id, stack) values (p_table, sn, uid, chips);
  perform public._pk_grant(uid, -t.buyin, case when t.kind = 'tournoi' then 'Tournoi de poker : droit d''entrée' else 'Poker : mise de départ à la table' end);
  select count(*) into n from public.poker_seats where table_id = p_table;
  if t.kind = 'tournoi' then
    update public.poker_tables set tourney = jsonb_set(tourney, '{pool}', to_jsonb((tourney ->> 'fee')::numeric * n)), last_activity = now() where id = p_table;
    if n >= t.max_seats then perform public._pk_tourney_start(p_table); end if;
  elsif n >= 2 and (t.hand is null or (t.hand ->> 'phase') = 'done') and t.next_hand_at is null then
    update public.poker_tables set next_hand_at = now() + interval '3 seconds', last_activity = now() where id = p_table;
  end if;
end;
$$;
revoke all on function public.poker_join(uuid) from public, anon, authenticated;
grant execute on function public.poker_join(uuid) to authenticated;

create or replace function public.poker_leave() returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.poker_seats%rowtype; t public.poker_tables%rowtype; h jsonb; left_n int; stk numeric;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select * into s from public.poker_seats where user_id = uid;
  if not found then return; end if;
  select * into t from public.poker_tables where id = s.table_id for update;
  h := t.hand;
  -- tournoi pas encore démarré : on récupère le droit d'entrée
  if t.kind = 'tournoi' and (t.tourney ->> 'status') = 'registering' then
    perform public._pk_grant(uid, t.buyin, 'Tournoi de poker : tu quittes avant le départ, droit d''entrée remboursé');
    delete from public.poker_seats where table_id = s.table_id and seat = s.seat;
    select count(*) into left_n from public.poker_seats where table_id = s.table_id;
    if left_n = 0 then delete from public.poker_tables where id = s.table_id;
    else update public.poker_tables set tourney = jsonb_set(tourney, '{pool}', to_jsonb((tourney ->> 'fee')::numeric * left_n)) where id = s.table_id; end if;
    return;
  end if;
  -- en pleine main : on se couche (la mise déjà engagée reste dans le pot)
  if h is not null and (h ->> 'phase') in ('preflop', 'flop', 'turn', 'river') and (h -> 'players' -> s.seat::text) is not null
     and not (h -> 'players' -> s.seat::text ->> 'folded')::boolean then
    if (h ->> 'to_act')::int = s.seat then
      perform public._pk_apply(s.table_id, s.seat, 'fold', 0);
    else
      h := public._pk_set(h, s.seat, 'folded', 'true'::jsonb);
      perform public._pk_advance(s.table_id, h);
    end if;
  end if;
  if t.kind = 'tournoi' then
    -- abandon en cours de tournoi : éliminé, la place est notée, les jetons sont perdus
    select count(*) into left_n from public.poker_seats where table_id = s.table_id;
    perform public._pk_tourney_record(s.table_id, uid, left_n);
    delete from public.poker_seats where table_id = s.table_id and seat = s.seat;
    if left_n - 1 <= 1 then
      select * into t from public.poker_tables where id = s.table_id;
      if t.hand is null or (t.hand ->> 'phase') = 'done' then perform public._pk_tourney_finish(s.table_id); end if;
    end if;
    return;
  end if;
  select stack into stk from public.poker_seats where table_id = s.table_id and seat = s.seat;
  if stk > 0 then perform public._pk_grant(uid, stk, 'Poker : tu quittes la table, tes jetons te reviennent'); end if;
  delete from public.poker_seats where table_id = s.table_id and seat = s.seat;
  select count(*) into left_n from public.poker_seats where table_id = s.table_id;
  if left_n = 0 then delete from public.poker_tables where id = s.table_id;
  elsif left_n = 1 then update public.poker_tables set next_hand_at = null where id = s.table_id and (hand is null or (hand ->> 'phase') = 'done'); end if;
end;
$$;
revoke all on function public.poker_leave() from public, anon, authenticated;
grant execute on function public.poker_leave() to authenticated;

create or replace function public.poker_get(p_table uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t public.poker_tables%rowtype; sn int; sec public.poker_secrets%rowtype; h jsonb; seats jsonb; me jsonb;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select seat into sn from public.poker_seats where table_id = p_table and user_id = uid;
  if sn is null then raise exception 'Tu n''es pas à cette table'; end if;
  perform public._pk_tick(p_table);
  select * into t from public.poker_tables where id = p_table;
  if not found then raise exception 'La table est fermée'; end if;
  select * into sec from public.poker_secrets where table_id = p_table;
  h := t.hand;
  select coalesce(jsonb_agg(jsonb_build_object('seat', s.seat, 'user_id', s.user_id, 'pseudo', p.pseudo, 'avatar_small', p.avatar_small, 'stack', s.stack, 'timeouts', s.timeouts,
           'in_hand', h is not null and (h -> 'players' -> s.seat::text) is not null,
           'bet', coalesce((h -> 'players' -> s.seat::text ->> 'bet')::numeric, 0), 'total', coalesce((h -> 'players' -> s.seat::text ->> 'total')::numeric, 0),
           'folded', coalesce((h -> 'players' -> s.seat::text ->> 'folded')::boolean, false), 'allin', coalesce((h -> 'players' -> s.seat::text ->> 'allin')::boolean, false)) order by s.seat), '[]'::jsonb)
    into seats from public.poker_seats s join public.profiles p on p.id = s.user_id where s.table_id = p_table;
  me := jsonb_build_object('seat', sn, 'hole', case when h is not null and (h -> 'players' -> sn::text) is not null then sec.holes -> sn::text else null end);
  return jsonb_build_object(
    'table', jsonb_build_object('id', t.id, 'name', t.name, 'buyin', t.buyin, 'sb', t.sb, 'bb', t.bb, 'owner', t.owner, 'max_seats', t.max_seats, 'hand_no', t.hand_no, 'kind', t.kind),
    'tourney', t.tourney,
    'seats', seats, 'me', me, 'now', now(),
    'hand', case when h is null then null else h - 'order' end,
    'next_hand_at', t.next_hand_at);
end;
$$;

revoke all on function public.poker_get(uuid) from public, anon, authenticated;
grant execute on function public.poker_get(uuid) to authenticated;

-- Résultat d'un tournoi (pour un joueur éliminé, qui n'est plus assis)
create or replace function public.poker_tourney_info(p_table uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); t public.poker_tables%rowtype;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select * into t from public.poker_tables where id = p_table and kind = 'tournoi';
  if not found then return null; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(t.tourney -> 'places', '[]'::jsonb)) x where (x ->> 'uid')::uuid = uid)
     and not exists (select 1 from public.poker_seats where table_id = p_table and user_id = uid) then return null; end if;
  return jsonb_build_object('name', t.name, 'tourney', t.tourney);
end;
$$;
revoke all on function public.poker_tourney_info(uuid) from public, anon, authenticated;
grant execute on function public.poker_tourney_info(uuid) to authenticated;

create or replace function public.poker_tables_list() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'buyin', t.buyin, 'sb', t.sb, 'bb', t.bb, 'seats', (select count(*) from public.poker_seats s where s.table_id = t.id),
           'max_seats', t.max_seats, 'playing', t.hand is not null and (t.hand ->> 'phase') <> 'done', 'owner', (select pseudo from public.profiles where id = t.owner), 'kind', t.kind,
           'status', t.tourney ->> 'status', 'pool', (t.tourney ->> 'pool')::numeric, 'level', (t.tourney ->> 'level')::int,
           'players', (select coalesce(jsonb_agg(p.pseudo order by s.seat), '[]'::jsonb) from public.poker_seats s join public.profiles p on p.id = s.user_id where s.table_id = t.id))
           order by t.created_at desc), '[]'::jsonb) into r
    from public.poker_tables t where t.last_activity > now() - interval '30 minutes' and (t.tourney is null or t.tourney ->> 'status' in ('registering', 'running'));
  return r;
end;
$$;
revoke all on function public.poker_tables_list() from public, anon, authenticated;
grant execute on function public.poker_tables_list() to authenticated;

-- Classement des tournois (saison en cours ou depuis toujours)
create or replace function public.tourney_leaderboard(p_all boolean default false) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x order by (x ->> 'wins')::int desc, (x ->> 'podiums')::int desc, (x ->> 'net')::numeric desc), '[]'::jsonb) into r from (
    select jsonb_build_object('user_id', p.id, 'pseudo', p.pseudo, 'avatar_small', p.avatar_small, 'played', count(*), 'wins', count(*) filter (where tr.place = 1),
             'podiums', count(*) filter (where tr.place <= 3), 'net', sum(tr.prize - tr.fee), 'best', min(tr.place)) as x
      from public.tourney_results tr join public.profiles p on p.id = tr.user_id
     where (p_all or tr.season = public.current_season()) and not p.is_bot
     group by p.id, p.pseudo, p.avatar_small order by count(*) filter (where tr.place = 1) desc, count(*) filter (where tr.place <= 3) desc, sum(tr.prize - tr.fee) desc limit 50) q;
  return r;
end;
$$;
revoke all on function public.tourney_leaderboard(boolean) from public, anon, authenticated;
grant execute on function public.tourney_leaderboard(boolean) to authenticated;

create or replace function public._pk_cleanup() returns void language plpgsql security definer set search_path = public as $$
declare t record; s record; rem int;
begin
  for t in select id, kind, tourney from public.poker_tables where last_activity < now() - interval '20 minutes' loop
    if t.kind = 'tournoi' then
      if t.tourney ->> 'status' = 'registering' then
        for s in select user_id from public.poker_seats where table_id = t.id loop perform public._pk_grant(s.user_id, (t.tourney ->> 'fee')::numeric, 'Tournoi de poker annulé (pas assez de joueurs), droit d''entrée remboursé'); end loop;
        delete from public.poker_tables where id = t.id;
      elsif t.tourney ->> 'status' = 'running' then
        -- tournoi abandonné : classement aux jetons
        select count(*) into rem from public.poker_seats where table_id = t.id;
        for s in select user_id from public.poker_seats where table_id = t.id order by stack asc loop
          exit when rem <= 1;
          perform public._pk_tourney_record(t.id, s.user_id, rem); rem := rem - 1;
          delete from public.poker_seats where table_id = t.id and user_id = s.user_id;
        end loop;
        perform public._pk_tourney_finish(t.id);
      else
        delete from public.poker_tables where id = t.id;
      end if;
    else
      for s in select user_id, stack from public.poker_seats where table_id = t.id loop
        if s.stack > 0 then perform public._pk_grant(s.user_id, s.stack, 'Poker : la table a fermé, tes jetons te reviennent'); end if;
      end loop;
      delete from public.poker_tables where id = t.id;
    end if;
  end loop;
end;
$$;
revoke all on function public._pk_cleanup() from public, anon, authenticated;
