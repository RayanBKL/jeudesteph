-- ============================================================
-- THE ASHTRAY KING — Migration 012 : vrai marché entre joueurs (plus aucun faux acheteur)
-- Ventes à prix fixe. La carte est mise « sous séquestre » (retirée de l'inventaire du vendeur) à la mise en vente ;
-- l'acheteur paie, reçoit la carte, et le vendeur reçoit l'argent (moins 5 %) à sa prochaine synchronisation.
-- ============================================================
create table if not exists public.market_offers (
  id uuid primary key default gen_random_uuid(),
  seller uuid not null references public.profiles(id) on delete cascade,
  card_id text not null references public.card_catalog(id),
  price numeric not null check (price >= 1 and price <= 1000000000000),
  status text not null default 'open' check (status in ('open', 'sold', 'cancelled')),
  buyer uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists market_offers_open on public.market_offers (card_id, price) where status = 'open';
create index if not exists market_offers_seller on public.market_offers (seller, status);
alter table public.market_offers enable row level security;
revoke all on public.market_offers from anon, authenticated;

alter table public.account_grants add column if not exists kind text not null default 'admin';

-- Les crédits en attente indiquent leur origine (admin ou vente sur le marché)
create or replace function public.my_grants() returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  with g as (update public.account_grants set applied_at = now() where user_id = auth.uid() and applied_at is null returning mode, amount, note, kind, created_at)
  select coalesce(jsonb_agg(jsonb_build_object('mode', mode, 'amount', amount, 'note', note, 'kind', kind) order by created_at), '[]'::jsonb) into r from g;
  return r;
end;
$$;
revoke all on function public.my_grants() from public, anon, authenticated;
grant execute on function public.my_grants() to authenticated;

create or replace function public.market_open() returns jsonb language plpgsql security definer set search_path = public stable as $$
declare r jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'card', o.card_id, 'price', o.price, 'seller', p.pseudo, 'mine', o.seller = auth.uid(), 'at', o.created_at) order by o.created_at desc), '[]'::jsonb) into r
    from (select * from public.market_offers where status = 'open' order by created_at desc limit 600) o join public.profiles p on p.id = o.seller;
  return r;
end;
$$;
revoke all on function public.market_open() from public, anon, authenticated;
grant execute on function public.market_open() to authenticated;

-- Mise en vente : la sauvegarde du vendeur doit contenir la carte (le jeu l'envoie juste avant)
create or replace function public.market_list(p_card text, p_price numeric) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.card_catalog%rowtype; inv jsonb; have numeric; oid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('market_list', 30, 600);
  select * into c from public.card_catalog where id = p_card;
  if not found then raise exception 'Carte inconnue'; end if;
  if p_price is null or p_price < 1 or p_price > greatest(c.val, 100) * 4 or p_price < greatest(c.val * 0.3, 1) then
    raise exception 'Prix hors limites (entre % et % €)', ceil(greatest(c.val * 0.3, 1)), floor(greatest(c.val, 100) * 4);
  end if;
  if (select count(*) from public.market_offers where seller = uid and status = 'open') >= 20 then raise exception 'Tu as déjà 20 annonces en ligne'; end if;
  begin
    select (data ->> 'empire_state')::jsonb -> 'inventory' into inv from public.cloud_saves where user_id = uid;
  exception when others then inv := null;
  end;
  have := coalesce((inv ->> p_card)::numeric, 0);
  if have < 1 then raise exception 'Cette carte n''est pas encore dans ta sauvegarde : réessaie dans quelques secondes'; end if;
  insert into public.market_offers (seller, card_id, price) values (uid, p_card, round(p_price)) returning id into oid;
  return oid;
end;
$$;
revoke all on function public.market_list(text, numeric) from public, anon, authenticated;
grant execute on function public.market_list(text, numeric) to authenticated;

create or replace function public.market_cancel(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare o public.market_offers%rowtype;
begin
  select * into o from public.market_offers where id = p_id and seller = auth.uid() for update;
  if not found or o.status <> 'open' then raise exception 'Cette annonce n''est plus disponible'; end if;
  update public.market_offers set status = 'cancelled', closed_at = now() where id = p_id;
  return o.card_id;
end;
$$;
revoke all on function public.market_cancel(uuid) from public, anon, authenticated;
grant execute on function public.market_cancel(uuid) to authenticated;

-- Achat : le jeu de l'acheteur a déjà débité l'argent et envoyé sa sauvegarde (solde vérifié ici)
create or replace function public.market_buy(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o public.market_offers%rowtype; cash numeric; sname text; cname text;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('market_buy', 60, 600);
  select * into o from public.market_offers where id = p_id for update;
  if not found or o.status <> 'open' then raise exception 'Cette offre n''est plus disponible'; end if;
  if o.seller = uid then raise exception 'Tu ne peux pas acheter ta propre annonce'; end if;
  -- le solde enregistré (avant le débit local) doit couvrir le prix
  select coalesce((public._jb(data ->> 'empire_clicker') ->> 'cash')::numeric, 0) into cash from public.cloud_saves where user_id = uid;
  if coalesce(cash, 0) < o.price then raise exception 'Solde insuffisant (ta sauvegarde en ligne n''est pas à jour, réessaie dans quelques secondes)'; end if;
  update public.market_offers set status = 'sold', buyer = uid, closed_at = now() where id = p_id;
  select name into cname from public.card_catalog where id = o.card_id;
  insert into public.account_grants (user_id, mode, amount, note, kind) values (o.seller, 'add', floor(o.price * 0.95), 'Vente : ' || coalesce(cname, o.card_id), 'market');
  return jsonb_build_object('card', o.card_id, 'price', o.price);
end;
$$;
revoke all on function public.market_buy(uuid) from public, anon, authenticated;
grant execute on function public.market_buy(uuid) to authenticated;

-- Nettoyage : les annonces fermées de plus de 60 jours
select cron.unschedule('marche-nettoyage') where exists (select 1 from cron.job where jobname = 'marche-nettoyage');
select cron.schedule('marche-nettoyage', '55 1 * * *', $$delete from public.market_offers where status <> 'open' and closed_at < now() - interval '60 days'$$);
