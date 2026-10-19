-- ============================================================
-- THE ASHTRAY KING — Migration 023 : Poker multijoueur (Texas Hold'em, tables avec mise de départ)
-- Un joueur ouvre une table avec une mise de départ (buy-in) ; jusqu'à 6 joueurs la rejoignent avec la même mise.
-- Le serveur distribue (cartes cachées), arbitre les mises (no-limit, tapis, pots annexes), les temps morts et le showdown.
-- Argent : la mise de départ est débitée par un « crédit » négatif (account_grants, kind 'poker') appliqué tout de suite par le jeu ;
-- en quittant la table (ou à la fin), les jetons restants reviennent par un crédit positif. Aucun bot à ces tables.
-- ============================================================
create table if not exists public.poker_tables (
  id uuid primary key default gen_random_uuid(),
  owner uuid references public.profiles(id) on delete set null,
  name text not null,
  buyin numeric not null,
  sb numeric not null,
  bb numeric not null,
  max_seats int not null default 6 check (max_seats between 2 and 6),
  hand jsonb,
  hand_no int not null default 0,
  next_hand_at timestamptz,
  created_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);
create table if not exists public.poker_seats (
  table_id uuid not null references public.poker_tables(id) on delete cascade,
  seat int not null,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stack numeric not null check (stack >= 0),
  timeouts int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (table_id, seat)
);
create table if not exists public.poker_secrets (
  table_id uuid primary key references public.poker_tables(id) on delete cascade,
  deck jsonb not null default '[]'::jsonb,
  holes jsonb not null default '{}'::jsonb
);
alter table public.poker_tables enable row level security;
alter table public.poker_seats enable row level security;
alter table public.poker_secrets enable row level security;
revoke all on public.poker_tables, public.poker_seats, public.poker_secrets from anon, authenticated;

-- ── Évaluation d'une main de 5 cartes ('Ah', 'Td', '9c'…) → score comparable (plus grand = meilleure main) ──
create or replace function public._pk_rank(c text) returns int language sql immutable as $$
  select case left(c, 1) when 'A' then 14 when 'K' then 13 when 'Q' then 12 when 'J' then 11 when 'T' then 10 else left(c, 1)::int end;
$$;

create or replace function public._pk_score5(h text[]) returns bigint language plpgsql immutable as $$
declare r int[]; i int; flush boolean; cnt int[] := array_fill(0, array[15]); cat int; straight boolean := false; hi int; kick int[] := '{}'; kk int; score bigint := 0; pairs int := 0; trips int := 0; quads int := 0;
begin
  select array_agg(public._pk_rank(x) order by public._pk_rank(x) desc) into r from unnest(h) x;
  flush := (select count(distinct right(x, 1)) from unnest(h) x) = 1;
  foreach i in array r loop cnt[i] := cnt[i] + 1; end loop;
  -- quinte (l'As peut valoir 1 : A-2-3-4-5)
  if (select count(distinct x) from unnest(r) x) = 5 then
    if r[1] - r[5] = 4 then straight := true; hi := r[1];
    elsif r[1] = 14 and r[2] = 5 and r[5] = 2 then straight := true; hi := 5; end if;
  end if;
  for kk in 2..14 loop
    if cnt[kk] = 4 then quads := quads + 1; elsif cnt[kk] = 3 then trips := trips + 1; elsif cnt[kk] = 2 then pairs := pairs + 1; end if;
  end loop;
  cat := case
    when straight and flush then 8 when quads = 1 then 7 when trips = 1 and pairs = 1 then 6 when flush then 5 when straight then 4
    when trips = 1 then 3 when pairs = 2 then 2 when pairs = 1 then 1 else 0 end;
  if straight then
    kick := array[hi, 0, 0, 0, 0];
  else
    -- cartes classées par nombre d'exemplaires puis par valeur (ex. full AAAKK = 14,14,14,13,13)
    select array_agg(v order by n desc, v desc) into kick from (select rk as v, cnt[rk] as n from generate_series(2, 14) rk, generate_series(1, 4) g where cnt[rk] >= g) z;
  end if;
  score := cat;
  for i in 1..5 loop score := score * 15 + coalesce(kick[i], 0); end loop;
  return score;
end;
$$;

-- Meilleure main de 5 cartes parmi 5 à 7
create or replace function public._pk_best(cards text[]) returns bigint language plpgsql immutable as $$
declare n int := cardinality(cards); a int; b int; c int; d int; e int; best bigint := -1; s bigint;
begin
  if n < 5 then return -1; end if;
  for a in 1..n - 4 loop for b in a + 1..n - 3 loop for c in b + 1..n - 2 loop for d in c + 1..n - 1 loop for e in d + 1..n loop
    s := public._pk_score5(array[cards[a], cards[b], cards[c], cards[d], cards[e]]);
    if s > best then best := s; end if;
  end loop; end loop; end loop; end loop; end loop;
  return best;
end;
$$;

create or replace function public._pk_name(score bigint) returns text language sql immutable as $$
  select (array['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'])[1 + (score / 759375)::int];
$$;

-- ── Petits outils sur l'état de la main (jsonb) ──
create or replace function public._pk_p(h jsonb, seat int, key text) returns jsonb language sql immutable as $$
  select h -> 'players' -> seat::text -> key;
$$;
create or replace function public._pk_set(h jsonb, seat int, key text, val jsonb) returns jsonb language sql immutable as $$
  select jsonb_set(h, array['players', seat::text, key], val);
$$;
-- prochain siège de la main après `from_seat` (dans l'ordre des sièges de la main) qui vérifie la condition
--   mode 'act'   : encore en jeu, pas à tapis, et pas encore parlé ou en retard sur la mise
--   mode 'alive' : encore en jeu (non couché)
create or replace function public._pk_next(h jsonb, from_seat int, mode text) returns int language plpgsql immutable as $$
declare ord int[]; n int; i int; idx int := 0; s int; j int;
begin
  select array_agg(x::int order by x::int) into ord from jsonb_array_elements_text(h -> 'order') x;
  n := cardinality(ord);
  for i in 1..n loop if ord[i] >= from_seat then idx := i; exit; end if; end loop;   -- position du siège de départ
  if idx = 0 then idx := n; elsif ord[idx] > from_seat then idx := idx - 1; end if;
  if idx = 0 then idx := n; end if;
  for j in 1..n loop
    s := ord[((idx - 1 + j) % n) + 1];
    if not (h -> 'players' -> s::text ->> 'folded')::boolean then
      if mode = 'alive' then return s; end if;
      if not (h -> 'players' -> s::text ->> 'allin')::boolean
         and (not (h -> 'players' -> s::text ->> 'acted')::boolean or (h -> 'players' -> s::text ->> 'bet')::numeric < (h ->> 'cur')::numeric) then return s; end if;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public._pk_cards(tid uuid, n int) returns jsonb language plpgsql security definer set search_path = public as $$
declare dk jsonb; res jsonb;
begin
  select poker_secrets.deck into dk from public.poker_secrets where table_id = tid for update;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into res from (select x from jsonb_array_elements(dk) with ordinality t(x, o) order by o limit n) q;
  update public.poker_secrets set deck = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(dk) with ordinality t(x, o) order by o offset n) q) where table_id = tid;
  return res;
end;
$$;

-- Crédit d'argent (jetons qui reviennent, mise de départ qui part) : appliqué par le jeu du joueur
create or replace function public._pk_grant(uid uuid, amount numeric, note text) returns void language sql security definer set search_path = public as $$
  insert into public.account_grants (user_id, mode, amount, note, kind) values (uid, 'add', amount, note, 'poker');
$$;

-- Argent disponible d'un joueur : sauvegarde en ligne + crédits en attente
create or replace function public._pk_cash(uid uuid) returns numeric language plpgsql security definer set search_path = public as $$
declare cash numeric; pend numeric;
begin
  select coalesce((public._jb(data ->> 'empire_clicker') ->> 'cash')::numeric, 0) into cash from public.cloud_saves where user_id = uid;
  select coalesce(sum(amount), 0) into pend from public.account_grants where user_id = uid and applied_at is null and mode = 'add';
  return coalesce(cash, 0) + pend;
end;
$$;
revoke all on function public._pk_cash(uuid) from public, anon, authenticated;
revoke all on function public._pk_grant(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public._pk_cards(uuid, int) from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════
-- Moteur d'une main
-- ══════════════════════════════════════════════════════════

-- Fin de main : le pot est distribué (pots annexes compris) et le résultat est publié
create or replace function public._pk_showdown(tid uuid, h jsonb, by_fold boolean) returns jsonb language plpgsql security definer set search_path = public as $$
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
  update public.poker_tables set hand = h, next_hand_at = now() + interval '8 seconds', last_activity = now() where id = tid;
  return h;
end;
$$;
revoke all on function public._pk_showdown(uuid, jsonb, boolean) from public, anon, authenticated;

-- Fait avancer la main : qui doit parler, nouveau tour d'enchères, showdown
create or replace function public._pk_advance(tid uuid, h jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.poker_tables%rowtype; seatk text; alive int; active int; needc int; need int; ncards int; nxt int; guard int := 0; board jsonb; ptr int; tot numeric := 0;
begin
  select * into t from public.poker_tables where id = tid;
  loop
    guard := guard + 1; if guard > 12 then exit; end if;
    alive := 0; active := 0; needc := 0; need := 0; tot := 0;
    for seatk in select jsonb_object_keys(h -> 'players') loop
      tot := tot + (h -> 'players' -> seatk ->> 'total')::numeric;
      if not (h -> 'players' -> seatk ->> 'folded')::boolean then
        alive := alive + 1;
        if not (h -> 'players' -> seatk ->> 'allin')::boolean then
          active := active + 1;
          if (h -> 'players' -> seatk ->> 'bet')::numeric < (h ->> 'cur')::numeric then needc := needc + 1; need := need + 1;
          elsif not (h -> 'players' -> seatk ->> 'acted')::boolean then need := need + 1; end if;
        end if;
      end if;
    end loop;
    h := jsonb_set(h, '{pot}', to_jsonb(tot));
    if alive <= 1 then return public._pk_showdown(tid, h, true); end if;

    if need = 0 or active = 0 or (active = 1 and needc = 0) then
      -- tour d'enchères terminé : les mises passent dans le pot, on retourne les cartes suivantes
      for seatk in select jsonb_object_keys(h -> 'players') loop
        h := public._pk_set(public._pk_set(h, seatk::int, 'bet', '0'::jsonb), seatk::int, 'acted', 'false'::jsonb);
      end loop;
      h := jsonb_set(jsonb_set(h, '{cur}', '0'), '{minraise}', to_jsonb(t.bb));
      h := jsonb_set(h, '{ptr}', h -> 'dealer');
      if (h ->> 'phase') = 'river' then return public._pk_showdown(tid, h, false); end if;
      ncards := case when (h ->> 'phase') = 'preflop' then 3 else 1 end;
      perform public._pk_cards(tid, 1);                      -- carte brûlée
      board := (h -> 'board') || public._pk_cards(tid, ncards);
      h := jsonb_set(jsonb_set(h, '{board}', board), '{phase}', to_jsonb(case (h ->> 'phase') when 'preflop' then 'flop' when 'flop' then 'turn' else 'river' end));
    else
      nxt := public._pk_next(h, (h ->> 'ptr')::int, 'act');
      if nxt is null then
        -- (sécurité) plus personne à faire parler : on force la fin du tour
        for seatk in select jsonb_object_keys(h -> 'players') loop h := public._pk_set(h, seatk::int, 'acted', 'true'::jsonb); end loop;
      else
        h := jsonb_set(jsonb_set(h, '{to_act}', to_jsonb(nxt)), '{deadline}', to_jsonb(now() + interval '30 seconds'));
        update public.poker_tables set hand = h, last_activity = now() where id = tid;
        return h;
      end if;
    end if;
  end loop;
  update public.poker_tables set hand = h where id = tid;
  return h;
end;
$$;
revoke all on function public._pk_advance(uuid, jsonb) from public, anon, authenticated;

-- Nouvelle main : bouton, cartes, blindes
create or replace function public._pk_start_hand(tid uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  t public.poker_tables%rowtype; seats int[]; n int; dealer int; prevd int; h jsonb; dk jsonb; hol jsonb := '{}'::jsonb; s int; i int; sbseat int; bbseat int; sbamt numeric; bbamt numeric; stk numeric; pl jsonb := '{}'::jsonb; r record;
  suits text[] := array['s','h','d','c']; ranks text[] := array['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
begin
  select * into t from public.poker_tables where id = tid for update;
  -- les joueurs absents (3 temps morts de suite) quittent la table avec leurs jetons
  for r in select seat, user_id, stack from public.poker_seats where table_id = tid and timeouts >= 3 loop
    if r.stack > 0 then perform public._pk_grant(r.user_id, r.stack, 'Poker : tu as quitté la table (absent), tes jetons te reviennent'); end if;
    delete from public.poker_seats where table_id = tid and seat = r.seat;
  end loop;
  delete from public.poker_seats where table_id = tid and stack <= 0;
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

-- Une action d'un joueur (ou un temps mort) : fold / check / call / raise (jusqu'à un total donné) / allin
create or replace function public._pk_apply(tid uuid, seat int, act text, amt numeric, by_timeout boolean default false) returns void language plpgsql security definer set search_path = public as $$
declare t public.poker_tables%rowtype; h jsonb; stk numeric; bet numeric; cur numeric; need numeric; newbet numeric; maxbet numeric; size numeric; k text; sk text := seat::text;
begin
  select * into t from public.poker_tables where id = tid for update;
  h := t.hand;
  if h is null or (h ->> 'phase') not in ('preflop', 'flop', 'turn', 'river') then raise exception 'Pas de main en cours'; end if;
  if (h ->> 'to_act')::int is distinct from seat then raise exception 'Ce n''est pas ton tour'; end if;
  select stack into stk from public.poker_seats where table_id = tid and poker_seats.seat = _pk_apply.seat;
  bet := (h -> 'players' -> sk ->> 'bet')::numeric; cur := (h ->> 'cur')::numeric;
  if act = 'allin' then act := 'raise'; amt := bet + stk; end if;
  if act = 'fold' then
    h := public._pk_set(h, seat, 'folded', 'true'::jsonb);
  elsif act = 'check' then
    if bet < cur then raise exception 'Tu dois suivre (%) ou te coucher', cur - bet; end if;
  elsif act = 'call' then
    need := least(stk, cur - bet);
    if need > 0 then
      stk := stk - need; bet := bet + need;
      h := public._pk_set(public._pk_set(public._pk_set(h, seat, 'bet', to_jsonb(bet)), seat, 'total', to_jsonb((h -> 'players' -> sk ->> 'total')::numeric + need)), seat, 'allin', to_jsonb(stk <= 0));
    end if;
  elsif act = 'raise' then
    maxbet := bet + stk; newbet := least(coalesce(amt, 0), maxbet);
    if newbet <= cur then
      -- relancer moins que la mise en cours = simplement suivre (tapis court)
      if newbet < maxbet then raise exception 'Relance trop faible : au moins %', cur + (h ->> 'minraise')::numeric; end if;
    elsif newbet < cur + (h ->> 'minraise')::numeric and newbet < maxbet then
      raise exception 'Relance minimale : %', cur + (h ->> 'minraise')::numeric;
    end if;
    need := newbet - bet;
    stk := stk - need;
    h := public._pk_set(public._pk_set(public._pk_set(h, seat, 'bet', to_jsonb(newbet)), seat, 'total', to_jsonb((h -> 'players' -> sk ->> 'total')::numeric + need)), seat, 'allin', to_jsonb(stk <= 0));
    if newbet > cur then
      size := newbet - cur;
      if size >= (h ->> 'minraise')::numeric then
        h := jsonb_set(h, '{minraise}', to_jsonb(size));
        for k in select jsonb_object_keys(h -> 'players') loop
          if k <> sk then h := public._pk_set(h, k::int, 'acted', 'false'::jsonb); end if;
        end loop;
      end if;
      h := jsonb_set(h, '{cur}', to_jsonb(newbet));
    end if;
  else
    raise exception 'Action inconnue';
  end if;
  update public.poker_seats set stack = stk, timeouts = case when by_timeout then timeouts + 1 else 0 end where table_id = tid and poker_seats.seat = _pk_apply.seat;
  h := public._pk_set(h, seat, 'acted', 'true'::jsonb);
  h := jsonb_set(h, '{ptr}', to_jsonb(seat));
  perform public._pk_advance(tid, h);
end;
$$;
revoke all on function public._pk_apply(uuid, int, text, numeric, boolean) from public, anon, authenticated;

-- Temps morts et enchaînement des mains (appelé à chaque lecture de la table)
create or replace function public._pk_tick(tid uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.poker_tables%rowtype; h jsonb; seat int;
begin
  select * into t from public.poker_tables where id = tid for update;
  if not found then return; end if;
  h := t.hand;
  if h is null or (h ->> 'phase') = 'done' then
    if t.next_hand_at is not null and now() >= t.next_hand_at then perform public._pk_start_hand(tid); end if;
  elsif (h ->> 'deadline') is not null and now() > (h ->> 'deadline')::timestamptz and (h ->> 'to_act') is not null then
    seat := (h ->> 'to_act')::int;
    perform public._pk_apply(tid, seat, case when (h -> 'players' -> seat::text ->> 'bet')::numeric >= (h ->> 'cur')::numeric then 'check' else 'fold' end, 0, true);
  end if;
end;
$$;
revoke all on function public._pk_tick(uuid) from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════
-- Fonctions appelables par les joueurs
-- ══════════════════════════════════════════════════════════
create or replace function public._pk_free_seat(tid uuid) returns int language sql security definer set search_path = public as $$
  select min(g) from generate_series(1, (select max_seats from public.poker_tables where id = tid)) g where g not in (select seat from public.poker_seats where table_id = tid);
$$;
revoke all on function public._pk_free_seat(uuid) from public, anon, authenticated;

create or replace function public.poker_create(p_name text, p_buyin numeric) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); tid uuid; nm text; b numeric := round(p_buyin);
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('poker_create', 6, 600);
  if b not in (1000, 5000, 20000, 100000, 500000, 2000000) then raise exception 'Mise de départ non autorisée'; end if;
  if exists (select 1 from public.poker_seats where user_id = uid) then raise exception 'Tu es déjà assis à une table : quitte-la d''abord'; end if;
  nm := left(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ''.,!?éèêëàâäîïôöùûüçÉÈÀÇ-]', '', 'g')), 24);
  if char_length(nm) < 2 then nm := 'Table de ' || (select pseudo from public.profiles where id = uid); end if;
  if public._pk_cash(uid) < b then raise exception 'Pas assez d''argent pour cette mise de départ (sauvegarde en ligne à jour ?)'; end if;
  insert into public.poker_tables (owner, name, buyin, sb, bb) values (uid, nm, b, b / 100, b / 50) returning id into tid;
  insert into public.poker_secrets (table_id) values (tid);
  insert into public.poker_seats (table_id, seat, user_id, stack) values (tid, 1, uid, b);
  perform public._pk_grant(uid, -b, 'Poker : mise de départ à la table');
  return tid;
end;
$$;
revoke all on function public.poker_create(text, numeric) from public, anon, authenticated;
grant execute on function public.poker_create(text, numeric) to authenticated;

create or replace function public.poker_join(p_table uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t public.poker_tables%rowtype; sn int; n int;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('poker_join', 20, 600);
  select * into t from public.poker_tables where id = p_table for update;
  if not found then raise exception 'Table introuvable'; end if;
  if exists (select 1 from public.poker_seats where user_id = uid) then raise exception 'Tu es déjà assis à une table'; end if;
  sn := public._pk_free_seat(p_table);
  if sn is null then raise exception 'Table complète'; end if;
  if public._pk_cash(uid) < t.buyin then raise exception 'Pas assez d''argent pour cette mise de départ (sauvegarde en ligne à jour ?)'; end if;
  insert into public.poker_seats (table_id, seat, user_id, stack) values (p_table, sn, uid, t.buyin);
  perform public._pk_grant(uid, -t.buyin, 'Poker : mise de départ à la table');
  select count(*) into n from public.poker_seats where table_id = p_table;
  if n >= 2 and (t.hand is null or (t.hand ->> 'phase') = 'done') and t.next_hand_at is null then
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
    'table', jsonb_build_object('id', t.id, 'name', t.name, 'buyin', t.buyin, 'sb', t.sb, 'bb', t.bb, 'owner', t.owner, 'max_seats', t.max_seats, 'hand_no', t.hand_no),
    'seats', seats, 'me', me, 'now', now(),
    'hand', case when h is null then null else h - 'order' end,
    'next_hand_at', t.next_hand_at);
end;
$$;
revoke all on function public.poker_get(uuid) from public, anon, authenticated;
grant execute on function public.poker_get(uuid) to authenticated;

create or replace function public.poker_action(p_table uuid, p_action text, p_amount numeric default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sn int;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('poker_act', 240, 60);
  select seat into sn from public.poker_seats where table_id = p_table and user_id = uid;
  if sn is null then raise exception 'Tu n''es pas à cette table'; end if;
  if p_action not in ('fold', 'check', 'call', 'raise', 'allin') then raise exception 'Action inconnue'; end if;
  perform public._pk_tick(p_table);
  perform public._pk_apply(p_table, sn, p_action, p_amount);
  return public.poker_get(p_table);
end;
$$;
revoke all on function public.poker_action(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.poker_action(uuid, text, numeric) to authenticated;

create or replace function public.poker_tables_list() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'buyin', t.buyin, 'sb', t.sb, 'bb', t.bb, 'seats', (select count(*) from public.poker_seats s where s.table_id = t.id),
           'max_seats', t.max_seats, 'playing', t.hand is not null and (t.hand ->> 'phase') <> 'done', 'owner', (select pseudo from public.profiles where id = t.owner),
           'players', (select coalesce(jsonb_agg(p.pseudo order by s.seat), '[]'::jsonb) from public.poker_seats s join public.profiles p on p.id = s.user_id where s.table_id = t.id))
           order by t.created_at desc), '[]'::jsonb) into r
    from public.poker_tables t where t.last_activity > now() - interval '30 minutes';
  return r;
end;
$$;
revoke all on function public.poker_tables_list() from public, anon, authenticated;
grant execute on function public.poker_tables_list() to authenticated;

create or replace function public.poker_my_table() returns uuid language sql stable security definer set search_path = public as $$
  select table_id from public.poker_seats where user_id = auth.uid();
$$;
revoke all on function public.poker_my_table() from public, anon, authenticated;
grant execute on function public.poker_my_table() to authenticated;

-- Tables abandonnées (aucune action depuis 20 min) : les jetons reviennent à leurs joueurs
create or replace function public._pk_cleanup() returns void language plpgsql security definer set search_path = public as $$
declare t record; s record;
begin
  for t in select id from public.poker_tables where last_activity < now() - interval '20 minutes' loop
    for s in select user_id, stack from public.poker_seats where table_id = t.id loop
      if s.stack > 0 then perform public._pk_grant(s.user_id, s.stack, 'Poker : la table a fermé, tes jetons te reviennent'); end if;
    end loop;
    delete from public.poker_tables where id = t.id;
  end loop;
end;
$$;
revoke all on function public._pk_cleanup() from public, anon, authenticated;
select cron.unschedule('poker-nettoyage') where exists (select 1 from cron.job where jobname = 'poker-nettoyage');
select cron.schedule('poker-nettoyage', '*/10 * * * *', $$select public._pk_cleanup()$$);
