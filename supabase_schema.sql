-- ============================================================
-- THE ASHTRAY KING — SCHEMA SUPABASE & SÉCURITÉ RLS
-- À exécuter dans le "SQL Editor" de Supabase
-- ============================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. TABLE PROFILES (Liée directement à auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null unique check (char_length(pseudo) >= 2 and char_length(pseudo) <= 25),
  friend_code text not null unique,
  money bigint not null default 500 check (money >= 0),
  xp bigint not null default 0 check (xp >= 0),
  level int not null default 1 check (level >= 1),
  skill_points int not null default 0 check (skill_points >= 0),
  skills jsonb not null default '{"slots":0,"energy":0,"cough":0,"recovery":0,"market":0}'::jsonb,
  stats jsonb not null default '{"totalRaces":0,"totalWins":0,"totalMoney":0,"goldStreak":0,"bestTimes":{}}'::jsonb,
  equipped_slots jsonb not null default '[null, null, null]'::jsonb,
  pity_counters jsonb not null default '{"tabac_epic":0,"duty_legendary":0,"contre_mythic":0}'::jsonb,
  free_packs int not null default 1,
  next_free_pack_at timestamptz default now() + interval '4 hours',
  mfa_enabled boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index pour classements rapides
create index if not exists idx_profiles_money on public.profiles(money desc);
create index if not exists idx_profiles_level on public.profiles(level desc);
create index if not exists idx_profiles_friend_code on public.profiles(friend_code);

-- 3. TRIGGER AUTOMATIQUE À L'INSCRIPTION AUTH
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_pseudo text;
  gen_code text;
begin
  user_pseudo := coalesce(new.raw_user_meta_data->>'pseudo', 'Stephane_' || substr(new.id::text, 1, 6));
  gen_code := upper(substr(regexp_replace(user_pseudo, '[^a-zA-Z0-9]', '', 'g'), 1, 4)) || '-' || lpad((floor(random() * 9000 + 1000)::int)::text, 4, '0');

  insert into public.profiles (id, pseudo, friend_code)
  values (new.id, user_pseudo, gen_code)
  on conflict (id) do nothing;
  
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. TABLE INVENTAIRE DES CIGARETTES
create table if not exists public.user_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cig_id text not null,
  count int not null default 1 check (count >= 0),
  equipped boolean not null default false,
  is_for_sale boolean not null default false,
  sale_price int default null check (sale_price is null or sale_price > 0),
  acquired_at timestamptz default now(),
  unique(user_id, cig_id)
);

create index if not exists idx_inventory_user on public.user_inventory(user_id);

-- 5. TABLE HISTORIQUE DES COURSES (Anti-triche & logs)
create table if not exists public.race_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  track text not null,
  race_time numeric(6, 2) not null check (race_time > 10.0), -- Anti-speedhack minimum
  medal text not null check (medal in ('gold', 'silver', 'bronze', 'none')),
  coughs int not null default 0,
  combos jsonb default '{}'::jsonb,
  reward_money int not null default 0 check (reward_money >= 0),
  reward_xp int not null default 0 check (reward_xp >= 0),
  created_at timestamptz default now()
);

create index if not exists idx_race_history_user on public.race_history(user_id, created_at desc);

-- 6. TABLE MARCHÉ PUBLIC DES JOUEURS
create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  seller_pseudo text not null,
  cig_id text not null,
  price int not null check (price >= 1 and price <= 1000000),
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  buyer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  sold_at timestamptz
);

create index if not exists idx_market_active on public.market_listings(status, created_at desc);

-- 7. TABLE AMIS & DÉFIS
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

-- ============================================================
-- SÉCURITÉ ROW LEVEL SECURITY (RLS) - NIVEAU BANQUE
-- ============================================================

-- Activer RLS sur toutes les tables
alter table public.profiles enable row level security;
alter table public.user_inventory enable row level security;
alter table public.race_history enable row level security;
alter table public.market_listings enable row level security;
alter table public.friendships enable row level security;

-- POLICIES : PROFILES
-- Lecture : Tout utilisateur authentifié peut voir les profils (pour classements et amis)
create policy "Les profils sont visibles publiquement par les joueurs"
  on public.profiles for select
  to authenticated
  using (true);

-- Modification : Un joueur ne peut modifier QUE son propre profil
create policy "Un joueur peut modifier uniquement son profil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- POLICIES : INVENTAIRE
-- Lecture : Le joueur ne voit que son propre inventaire (sauf s'il vend un item)
create policy "Un joueur voit uniquement son inventaire"
  on public.user_inventory for select
  to authenticated
  using (auth.uid() = user_id or is_for_sale = true);

-- Insertion : Le joueur n'ajoute que dans son inventaire
create policy "Un joueur ajoute uniquement dans son inventaire"
  on public.user_inventory for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Modification : Le joueur modifie uniquement ses objets
create policy "Un joueur modifie uniquement son inventaire"
  on public.user_inventory for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Suppression : Le joueur supprime uniquement ses objets
create policy "Un joueur supprime uniquement ses objets"
  on public.user_inventory for delete
  to authenticated
  using (auth.uid() = user_id);

-- POLICIES : HISTORIQUE DE COURSE
create policy "Un joueur consulte ses courses"
  on public.race_history for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Un joueur enregistre sa course"
  on public.race_history for insert
  to authenticated
  with check (auth.uid() = user_id);

-- POLICIES : MARCHÉ
create policy "Tout joueur voit les offres actives du marché"
  on public.market_listings for select
  to authenticated
  using (status = 'active' or seller_id = auth.uid() or buyer_id = auth.uid());

create policy "Un joueur peut publier une offre"
  on public.market_listings for insert
  to authenticated
  with check (auth.uid() = seller_id);

create policy "Un joueur peut annuler son offre"
  on public.market_listings for update
  to authenticated
  using (auth.uid() = seller_id or auth.uid() = buyer_id);

-- POLICIES : AMIS
create policy "Un joueur voit ses amis"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Un joueur ajoute un ami"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Un joueur gère ses amitiés"
  on public.friendships for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Un joueur supprime un ami"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);
