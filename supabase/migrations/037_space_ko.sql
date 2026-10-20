-- ============================================================
-- THE ASHTRAY KING — Migration 037 : tournois « Space KO » (règles du format Winamax) + mains plus rapides
--  • répartition du droit d'entrée : 40 % classement classique, 50 % primes (tokens), 10 % commission (retirée de l'économie)
--  • chaque joueur démarre avec un token de niveau 1 (valeur moyenne = 50 % du droit d'entrée) ; 14 niveaux de tokens (4 légendaires)
--  • à chaque élimination : prime tirée au sort = multiplicateur (0,4× à 100×, le 100× ≈ 1 fois sur 1 000) × valeur moyenne du token de l'éliminé ;
--    la moitié est versée en cash à l'éliminateur, l'autre moitié s'ajoute à son propre token ; une seule prime partagée si plusieurs éliminateurs
--  • le vainqueur reçoit sa propre prime, tirée sur son token
--  • 6 joueurs max, 20 000 jetons, blindes 100/200 au départ, durée des niveaux choisie par l'admin (events.level_min)
--  • 2 secondes entre deux mains
-- ============================================================
alter table public.events add column if not exists level_min int not null default 5 check (level_min between 1 and 15);

-- Niveaux de tokens (valeur moyenne du token en multiples du droit d'entrée) : le niveau 1 = 0,5 ; le niveau 6 = 3 (exemple publié par Winamax : 5 € -> 30 €)
create or replace function public._ko_levels() returns numeric[] language sql immutable as $$ select array[0.5,0.75,1,1.5,2,3,4.5,7,10,15,25,50,100,250]::numeric[] $$;
create or replace function public._ko_level(p_avg numeric, p_fee numeric) returns int language sql immutable as $$
  select greatest(1, (select count(*) from unnest(public._ko_levels()) x where p_fee > 0 and x * p_fee <= p_avg + 0.0001))::int $$;
-- Tirage de la prime : multiplicateur 0,4 (59,5 %), 1 (27,7 %), 2 (8 %), 3 (3,5 %), 10 (1,2 %), 100 (0,1 %) : moyenne exactement 1
create or replace function public._ko_draw(p_avg numeric) returns jsonb language plpgsql volatile as $$
declare r numeric := random(); m numeric;
begin
  m := case when r < 0.595 then 0.4 when r < 0.872 then 1 when r < 0.952 then 2 when r < 0.987 then 3 when r < 0.999 then 10 else 100 end;
  return jsonb_build_object('m', m, 'b', floor(p_avg * m));
end;
$$;
revoke all on function public._ko_levels() from public, anon, authenticated;
revoke all on function public._ko_level(numeric, numeric) from public, anon, authenticated;
revoke all on function public._ko_draw(numeric) from public, anon, authenticated;

create or replace function public._pk_tourney_start(tid uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.poker_tables%rowtype; cnt int; plist jsonb; fee numeric; toks jsonb;
begin
  select * into t from public.poker_tables where id = tid for update;
  fee := coalesce((t.tourney ->> 'fee')::numeric, 0);
  select count(*), jsonb_agg(jsonb_build_object('uid', s.user_id, 'pseudo', p.pseudo)) into cnt, plist from public.poker_seats s join public.profiles p on p.id = s.user_id where s.table_id = tid;
  select coalesce(jsonb_object_agg(s.user_id::text, floor(fee * 0.5)), '{}'::jsonb) into toks from public.poker_seats s where s.table_id = tid;
  update public.poker_tables set sb = 100, bb = 200, next_hand_at = now() + interval '3 seconds', last_activity = now(),
    tourney = t.tourney || jsonb_build_object('status', 'running', 'started_at', now(), 'level', 1, 'players', plist,
      'pool', floor(fee * 0.4) * cnt + coalesce((t.tourney ->> 'event_prize')::numeric, 0),
      'bounty_each', floor(fee * 0.5), 'tokens', toks, 'log', '[]'::jsonb, 'places', '[]'::jsonb, 'kills', '{}'::jsonb, 'bounty_won', '{}'::jsonb, 'forfeit', 0)
   where id = tid;
end;
$$;

create or replace function public._pk_tourney_kill(tid uuid, victim uuid, killers uuid[]) returns void language plpgsql security definer set search_path = public as $$
declare t public.poker_tables%rowtype; fee numeric; v numeric; d jsonb; b numeric; share numeric; cashp numeric; tokp numeric; k uuid; n int; vname text; kname text; lg jsonb;
begin
  select * into t from public.poker_tables where id = tid for update;
  fee := coalesce((t.tourney ->> 'fee')::numeric, 0);
  n := coalesce(cardinality(killers), 0);
  if fee <= 0 or n = 0 then return; end if;          -- pas de prime sans droit d'entrée, ni pour un abandon
  v := coalesce((t.tourney -> 'tokens' ->> victim::text)::numeric, floor(fee * 0.5));
  d := public._ko_draw(v); b := (d ->> 'b')::numeric;
  share := floor(b / n); cashp := floor(share / 2); tokp := share - cashp;      -- moitié en cash, moitié sur le token de l'éliminateur
  select pseudo into vname from public.profiles where id = victim;
  foreach k in array killers loop
    if cashp > 0 then perform public._pk_grant(k, cashp, 'Space KO : prime pour avoir sorti ' || coalesce(vname, 'un joueur') || ' (+' || cashp || ' €, x' || (d ->> 'm') || ')'); end if;
    update public.poker_tables set tourney = jsonb_set(jsonb_set(jsonb_set(tourney,
        array['kills', k::text], to_jsonb(coalesce((tourney -> 'kills' ->> k::text)::int, 0) + 1), true),
        array['bounty_won', k::text], to_jsonb(coalesce((tourney -> 'bounty_won' ->> k::text)::numeric, 0) + cashp), true),
        array['tokens', k::text], to_jsonb(coalesce((tourney -> 'tokens' ->> k::text)::numeric, floor(fee * 0.5)) + tokp), true) where id = tid;
  end loop;
  select string_agg(pseudo, ' + ') into kname from public.profiles where id = any(killers);
  lg := coalesce(t.tourney -> 'log', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('k', kname, 'v', vname, 'm', d -> 'm', 'b', b));
  if jsonb_array_length(lg) > 8 then lg := (select jsonb_agg(x order by o) from (select x, o from jsonb_array_elements(lg) with ordinality e(x, o) order by o desc limit 8) q); end if;
  update public.poker_tables set tourney = jsonb_set(tourney, '{log}', lg) where id = tid;
end;
$$;

create or replace function public._pk_tourney_finish(tid uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.poker_tables%rowtype; tr jsonb; bw numeric; own numeric; pool numeric; n int; pct numeric[]; w record; places jsonb; p jsonb; pr numeric; paid numeric := 0; fee numeric; i int; d jsonb; wav numeric;
begin
  select * into t from public.poker_tables where id = tid for update;
  tr := t.tourney;
  if tr is null or tr ->> 'status' = 'done' then return; end if;
  for w in select user_id from public.poker_seats where table_id = tid order by stack desc limit 1 loop
    perform public._pk_tourney_record(tid, w.user_id, 1);
  end loop;
  select * into t from public.poker_tables where id = tid;
  tr := t.tourney; places := coalesce(tr -> 'places', '[]'::jsonb);
  pool := (tr ->> 'pool')::numeric + coalesce((tr ->> 'forfeit')::numeric, 0); fee := (tr ->> 'fee')::numeric; n := jsonb_array_length(coalesce(tr -> 'players', '[]'::jsonb));
  pct := case when n <= 3 then array[0.7, 0.3] else array[0.5, 0.3, 0.2] end;
  places := (select coalesce(jsonb_agg(x order by (x ->> 'place')::int), '[]'::jsonb) from jsonb_array_elements(places) x);
  for p in select * from jsonb_array_elements(places) loop
    i := (p ->> 'place')::int;
    pr := case when i <= cardinality(pct) then floor(pool * pct[i]) else 0 end;
    if i = 1 then pr := pool - (select coalesce(sum(floor(pool * pct[g])), 0) from generate_series(2, cardinality(pct)) g); end if;
    paid := paid + pr;
    if pr > 0 then perform public._pk_grant((p ->> 'uid')::uuid, pr, 'Space KO : place ' || i || ' sur ' || n || ', classement +' || pr || ' €'); end if;
    bw := coalesce((tr -> 'bounty_won' ->> (p ->> 'uid'))::numeric, 0);
    own := 0;
    if i = 1 and fee > 0 then
      -- le vainqueur reçoit SA PROPRE prime : un dernier tirage sur son token, versé en entier
      wav := coalesce((tr -> 'tokens' ->> (p ->> 'uid'))::numeric, floor(fee * 0.5));
      d := public._ko_draw(wav); own := (d ->> 'b')::numeric;
      if own > 0 then perform public._pk_grant((p ->> 'uid')::uuid, own, 'Space KO : ta propre prime de vainqueur (+' || own || ' €, x' || (d ->> 'm') || ')'); end if;
      tr := jsonb_set(tr, '{own}', jsonb_build_object('uid', p ->> 'uid', 'm', d -> 'm', 'b', own), true);
    end if;
    insert into public.tourney_results (table_id, user_id, place, players, fee, prize, bounty) values (tid, (p ->> 'uid')::uuid, i, n, fee, pr, bw + own);
    places := jsonb_set(places, array[(i - 1)::text], (p || jsonb_build_object('prize', pr, 'bounty', bw + own, 'kills', coalesce((tr -> 'kills' ->> (p ->> 'uid'))::int, 0))));
  end loop;
  delete from public.poker_seats where table_id = tid;
  update public.poker_tables set hand = null, next_hand_at = null, last_activity = now(), tourney = jsonb_set(jsonb_set(tr, '{status}', '"done"'), '{places}', places) where id = tid;
end;
$$;
revoke all on function public._pk_tourney_start(uuid) from public, anon, authenticated;
revoke all on function public._pk_tourney_kill(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public._pk_tourney_finish(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._pk_start_hand(tid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t public.poker_tables%rowtype; seats int[]; n int; lvl int; remaining int; killers uuid[]; sbl int[] := array[100,150,200,300,400,500,600,800,1000,1250,1500,2000,2500,3000,4000,5000,6000,8000,10000,12500,15000]; dealer int; prevd int; h jsonb; dk jsonb; hol jsonb := '{}'::jsonb; s int; i int; sbseat int; bbseat int; sbamt numeric; bbamt numeric; stk numeric; pl jsonb := '{}'::jsonb; r record;
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
      -- éliminateur(s) : le(s) gagnant(s) du plus gros pot de la dernière main (sauf départ ou absence : pas d'éliminateur)
      killers := null;
      if (select stack from public.poker_seats where table_id = tid and seat = r.seat) <= 0 and (t.hand -> 'result' -> 'payouts') is not null then
        select array_agg(distinct (t.hand -> 'players' -> pk.key ->> 'uid')::uuid) into killers
          from jsonb_each_text(t.hand -> 'result' -> 'payouts') pk
         where (t.hand -> 'players' -> pk.key ->> 'uid') is not null and (t.hand -> 'players' -> pk.key ->> 'uid')::uuid <> r.user_id
           and pk.value::numeric = (select max(v.value::numeric) from jsonb_each_text(t.hand -> 'result' -> 'payouts') v where (t.hand -> 'players' -> v.key ->> 'uid')::uuid <> r.user_id);
      end if;
      perform public._pk_tourney_kill(tid, r.user_id, killers);
      remaining := remaining - 1;
      delete from public.poker_seats where table_id = tid and seat = r.seat;
    end loop;
    if remaining <= 1 then perform public._pk_tourney_finish(tid); return; end if;
    -- niveau de blindes : +1 à chaque durée de niveau de l'évènement (level_secs)
    lvl := least(cardinality(sbl), 1 + floor(extract(epoch from (now() - (t.tourney ->> 'started_at')::timestamptz))  / greatest(30, coalesce((t.tourney ->> 'level_secs')::numeric, 120)))::int);
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
$function$;
revoke all on function public._pk_start_hand(uuid) from public, anon, authenticated;
CREATE OR REPLACE FUNCTION public._pk_showdown(tid uuid, h jsonb, by_fold boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sec public.poker_secrets%rowtype; seatk text; board text[]; scores jsonb := '{}'::jsonb; sc bigint; hole text[];
  levels numeric[]; lv numeric; prev numeric := 0; slice numeric; best bigint; winners int[]; w int; share numeric; rem numeric; payouts jsonb := '{}'::jsonb; names jsonb := '{}'::jsonb;
  shown jsonb := '{}'::jsonb; dealer int := (h ->> 'dealer')::int; ord int[]; total_all numeric := 0; allocated numeric := 0; first_w int; tot numeric; i int; res jsonb; sidx int;
begin
  select * into sec from public.poker_secrets where table_id = tid;
  select array_agg(x::int order by x::int) into ord from jsonb_array_elements_text(h -> 'order') x;
  select array_agg(x) into board from jsonb_array_elements_text(h -> 'board') x;
  board := coalesce(board, '{}');
  for seatk in select jsonb_object_keys(h -> 'players') loop total_all := total_all + (h -> 'players' -> seatk ->> 'total')::numeric; end loop;

  if by_fold then
    -- un seul joueur reste : il ramasse tout (sans montrer ses cartes)
    for seatk in select jsonb_object_keys(h -> 'players') loop
      if not (h -> 'players' -> seatk ->> 'folded')::boolean then payouts := jsonb_build_object(seatk, total_all); end if;
    end loop;
  else
    for seatk in select jsonb_object_keys(h -> 'players') loop
      if not (h -> 'players' -> seatk ->> 'folded')::boolean then
        select array_agg(x) into hole from jsonb_array_elements_text(sec.holes -> seatk) x;
        sc := public._pk_best(hole || board);
        scores := scores || jsonb_build_object(seatk, sc);
        shown := shown || jsonb_build_object(seatk, sec.holes -> seatk);
        names := names || jsonb_build_object(seatk, public._pk_name(sc));
      end if;
    end loop;
    select array_agg(distinct (h -> 'players' -> k ->> 'total')::numeric order by (h -> 'players' -> k ->> 'total')::numeric) into levels
      from jsonb_object_keys(h -> 'players') k where not (h -> 'players' -> k ->> 'folded')::boolean;
    foreach lv in array levels loop
      slice := 0;
      for seatk in select jsonb_object_keys(h -> 'players') loop
        tot := (h -> 'players' -> seatk ->> 'total')::numeric;
        slice := slice + greatest(0, least(tot, lv) - prev);
      end loop;
      best := null; winners := '{}';
      for seatk in select jsonb_object_keys(h -> 'players') loop
        if not (h -> 'players' -> seatk ->> 'folded')::boolean and (h -> 'players' -> seatk ->> 'total')::numeric >= lv then
          sc := (scores ->> seatk)::bigint;
          if best is null or sc > best then best := sc; winners := array[seatk::int]; elsif sc = best then winners := winners || seatk::int; end if;
        end if;
      end loop;
      if slice > 0 and cardinality(winners) > 0 then
        share := floor(slice / cardinality(winners)); rem := slice - share * cardinality(winners);
        -- le reste va au premier gagnant à gauche du bouton
        first_w := null;
        sidx := array_position(ord, coalesce((select min(o) from unnest(ord) o where o > dealer), ord[1]));
        for i in 0..cardinality(ord) - 1 loop
          w := ord[((sidx - 1 + i) % cardinality(ord)) + 1];
          if w = any(winners) then first_w := w; exit; end if;
        end loop;
        foreach w in array winners loop
          payouts := jsonb_set(payouts, array[w::text], to_jsonb(coalesce((payouts ->> w::text)::numeric, 0) + share + case when w = first_w then rem else 0 end), true);
        end loop;
        allocated := allocated + slice;
      end if;
      prev := lv;
    end loop;
  end if;

  -- les jetons gagnés retournent sur les sièges
  for seatk in select jsonb_object_keys(payouts) loop
    update public.poker_seats set stack = stack + (payouts ->> seatk)::numeric where table_id = tid and seat = seatk::int;
  end loop;

  res := jsonb_build_object('reason', case when by_fold then 'fold' else 'showdown' end, 'payouts', payouts, 'shown', case when by_fold then '{}'::jsonb else shown end, 'names', names, 'board', to_jsonb(board));
  h := jsonb_set(jsonb_set(jsonb_set(h, '{phase}', '"done"'), '{to_act}', 'null'::jsonb), '{result}', res);
  h := jsonb_set(h, '{pot}', to_jsonb(total_all));
  update public.poker_tables set hand = h, next_hand_at = now() + interval '2 seconds', last_activity = now() where id = tid;
  return h;
end;
$function$;
revoke all on function public._pk_showdown(uuid, jsonb, boolean) from public, anon, authenticated;
CREATE OR REPLACE FUNCTION public._event_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.events%rowtype; regs uuid[]; tid uuid; i int; r uuid;
begin
  for e in select * from public.events where status = 'scheduled' and starts_at <= now() order by starts_at for update skip locked loop
    select coalesce(array_agg(user_id order by created_at), '{}') into regs from public.event_regs where event_id = e.id;
    -- quelqu'un joue déjà à une table : il est retiré de l'évènement (remboursé)
    foreach r in array regs loop
      if exists (select 1 from public.poker_seats where user_id = r) then
        delete from public.event_regs where event_id = e.id and user_id = r;
        if e.fee > 0 then perform public._pk_grant(r, e.fee, 'Évènement « ' || e.title || ' » : tu étais déjà à une table, droit d''entrée remboursé'); end if;
        regs := array_remove(regs, r);
      end if;
    end loop;
    if coalesce(cardinality(regs), 0) < 2 then
      foreach r in array regs loop if e.fee > 0 then perform public._pk_grant(r, e.fee, 'Évènement « ' || e.title || ' » annulé (pas assez d''inscrits) : remboursé'); end if; end loop;
      update public.events set status = 'cancelled' where id = e.id;
      continue;
    end if;
    insert into public.poker_tables (owner, name, buyin, sb, bb, max_seats, kind, tourney)
      values (regs[1], e.title, e.fee, 100, 200, greatest(2, cardinality(regs)), 'tournoi',
        jsonb_build_object('status', 'registering', 'fee', e.fee, 'max', cardinality(regs), 'chips', 20000, 'level_secs', e.level_min * 60, 'pool', 0, 'bounty_each', floor(e.fee * 0.5), 'level', 1, 'places', '[]'::jsonb, 'event_id', e.id, 'event_prize', e.prize))
      returning id into tid;
    insert into public.poker_secrets (table_id) values (tid);
    for i in 1..cardinality(regs) loop
      insert into public.poker_seats (table_id, seat, user_id, stack) values (tid, i, regs[i], 20000);
      perform public._push_notify(regs[i], e.title, 'Ton tournoi commence : ta place est à la table !', 'event-' || e.id::text);
    end loop;
    perform public._pk_tourney_start(tid);
    update public.events set status = 'running', table_id = tid where id = e.id;
  end loop;
  -- évènements terminés
  update public.events ev set status = 'done' where ev.status = 'running' and exists (select 1 from public.poker_tables t where t.id = ev.table_id and t.tourney ->> 'status' = 'done');
  update public.events ev set status = 'done' where ev.status = 'running' and not exists (select 1 from public.poker_tables t where t.id = ev.table_id);
end;
$function$;
revoke all on function public._event_tick() from public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.events_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid();
begin
  if uid is null then return '[]'::jsonb; end if;
  perform public._event_tick();
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'description', e.description, 'starts_at', e.starts_at, 'fee', e.fee, 'max', e.max_players, 'level_min', e.level_min, 'prize', e.prize, 'status', e.status,
    'regs', (select count(*) from public.event_regs r where r.event_id = e.id),
    'mine', exists (select 1 from public.event_regs r where r.event_id = e.id and r.user_id = uid),
    'table_id', case when e.status = 'running' and exists (select 1 from public.poker_seats s where s.table_id = e.table_id and s.user_id = uid) then e.table_id end) order by e.starts_at)
    from public.events e where e.status in ('scheduled', 'running') and e.starts_at > now() - interval '3 hours'), '[]'::jsonb);
end;
$function$;
revoke all on function public.events_list() from public, anon, authenticated;
grant execute on function public.events_list() to authenticated;

drop function if exists public.admin_event_create(text, text, timestamptz, numeric, int, numeric);
create or replace function public.admin_event_create(p_title text, p_desc text, p_starts timestamptz, p_fee numeric, p_max int, p_prize numeric, p_level_min int default 5) returns uuid
language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  if p_starts is null or p_starts < now() + interval '2 minutes' then raise exception 'La date de départ doit être dans le futur'; end if;
  insert into public.events (title, description, starts_at, fee, max_players, prize, level_min, created_by)
    values (left(btrim(p_title), 40), nullif(left(btrim(coalesce(p_desc, '')), 240), ''), p_starts, round(coalesce(p_fee, 0)), coalesce(p_max, 6), round(coalesce(p_prize, 0)), greatest(1, least(15, coalesce(p_level_min, 5))), auth.uid()) returning id into eid;
  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), 'event_create', jsonb_build_object('event', eid, 'title', p_title, 'starts', p_starts, 'fee', p_fee, 'prize', p_prize, 'level_min', p_level_min));
  return eid;
end;
$$;
revoke all on function public.admin_event_create(text, text, timestamptz, numeric, int, numeric, int) from public, anon, authenticated;
grant execute on function public.admin_event_create(text, text, timestamptz, numeric, int, numeric, int) to authenticated;
