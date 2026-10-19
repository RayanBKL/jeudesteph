-- Historique des ventes et achats d'un joueur sur la Bourse (60 dernières opérations)
create or replace function public.market_history() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); r jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x order by x.at desc), '[]'::jsonb) into r from (
    select jsonb_build_object(
             'card', o.card_id, 'price', o.price, 'at', o.closed_at, 'sold', o.seller = uid,
             'net', case when o.seller = uid then floor(o.price * 0.95) else null end,
             'other', (select pseudo from public.profiles where id = case when o.seller = uid then o.buyer else o.seller end)) as x,
           o.closed_at as at
      from public.market_offers o
     where o.status = 'sold' and (o.seller = uid or o.buyer = uid)
     order by o.closed_at desc limit 60) q;
  return r;
end;
$$;
revoke all on function public.market_history() from public, anon;
grant execute on function public.market_history() to authenticated;
