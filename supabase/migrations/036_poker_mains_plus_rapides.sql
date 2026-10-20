-- ============================================================
-- THE ASHTRAY KING — Migration 036 : poker, moins d'attente entre deux mains (8 s -> 4 s après le résultat)
-- ============================================================
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
  update public.poker_tables set hand = h, next_hand_at = now() + interval '4 seconds', last_activity = now() where id = tid;
  return h;
end;
$function$;
revoke all on function public._pk_showdown(uuid, jsonb, boolean) from public, anon, authenticated;
