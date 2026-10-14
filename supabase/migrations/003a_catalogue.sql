-- Catalogue des cartes côté serveur (quiz et Ultimate Comptoir). Rempli par scripts/seed_card_catalog.py
create table if not exists public.card_catalog (
  id text primary key,
  name text not null,
  cat text not null,
  rarity text not null,
  img text,
  quiz_ok boolean not null default false,
  pos text,
  nat text,
  clubs text[] not null default '{}',
  ovr int
);
create index if not exists card_catalog_cat on public.card_catalog (cat) where quiz_ok;
alter table public.card_catalog enable row level security;
drop policy if exists "Catalogue lisible" on public.card_catalog;
create policy "Catalogue lisible" on public.card_catalog for select to authenticated using (true);
revoke all on public.card_catalog from anon, authenticated;
grant select on public.card_catalog to authenticated;
