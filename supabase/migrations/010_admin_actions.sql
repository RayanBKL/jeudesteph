-- ============================================================
-- THE ASHTRAY KING — Migration 010 : actions admin (modifier les crédits d'un joueur, supprimer un compte) + journal
-- Les crédits sont enregistrés comme « cadeaux en attente » : le jeu du joueur les applique à sa prochaine synchronisation
-- (une sauvegarde qui contient déjà l'ancien solde ne peut donc pas les écraser).
-- ============================================================
create table if not exists public.admin_log (
  id bigserial primary key,
  admin_id uuid,
  action text not null,
  target_id uuid,
  target_pseudo text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_log_target on public.admin_log (target_id, created_at desc);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;

create table if not exists public.account_grants (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('add', 'set')),
  amount numeric not null check (amount between -1000000000000 and 1000000000000),
  note text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists account_grants_pending on public.account_grants (user_id) where applied_at is null;
alter table public.account_grants enable row level security;
revoke all on public.account_grants from anon, authenticated;

create or replace function public.admin_grant_cash(p_id uuid, p_mode text, p_amount numeric, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare ps text;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  if p_mode not in ('add', 'set') then raise exception 'Mode inconnu'; end if;
  if p_amount is null or p_amount < -1e12 or p_amount > 1e12 then raise exception 'Montant invalide'; end if;
  if p_mode = 'set' and p_amount < 0 then raise exception 'Le solde ne peut pas être négatif'; end if;
  select pseudo into ps from public.profiles where id = p_id;
  if ps is null then raise exception 'Joueur introuvable'; end if;
  insert into public.account_grants (user_id, mode, amount, note) values (p_id, p_mode, p_amount, left(p_note, 200));
  insert into public.admin_log (admin_id, action, target_id, target_pseudo, detail)
    values (auth.uid(), 'crédits', p_id, ps, jsonb_build_object('mode', p_mode, 'montant', p_amount, 'note', left(p_note, 200)));
end;
$$;
revoke all on function public.admin_grant_cash(uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.admin_grant_cash(uuid, text, numeric, text) to authenticated;

-- Appelée par le jeu du joueur : récupère (une seule fois) les crédits en attente
create or replace function public.my_grants() returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  with g as (update public.account_grants set applied_at = now() where user_id = auth.uid() and applied_at is null returning mode, amount, note, created_at)
  select coalesce(jsonb_agg(jsonb_build_object('mode', mode, 'amount', amount, 'note', note) order by created_at), '[]'::jsonb) into r from g;
  return r;
end;
$$;
revoke all on function public.my_grants() from public, anon, authenticated;
grant execute on function public.my_grants() to authenticated;

create or replace function public.admin_delete_user(p_id uuid, p_confirm text) returns void language plpgsql security definer set search_path = public as $$
declare ps text;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  if p_id = auth.uid() then raise exception 'Tu ne peux pas supprimer ton propre compte ici'; end if;
  if exists (select 1 from public.admin_users where user_id = p_id) then raise exception 'Un compte admin ne peut pas être supprimé ici'; end if;
  select pseudo into ps from public.profiles where id = p_id;
  if ps is null then raise exception 'Joueur introuvable'; end if;
  if lower(trim(coalesce(p_confirm, ''))) <> lower(ps) then raise exception 'Le pseudo de confirmation ne correspond pas'; end if;
  insert into public.admin_log (admin_id, action, target_id, target_pseudo, detail) values (auth.uid(), 'suppression', p_id, ps, '{}'::jsonb);
  delete from auth.users where id = p_id;
end;
$$;
revoke all on function public.admin_delete_user(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_delete_user(uuid, text) to authenticated;

create or replace function public.admin_log_list(p_target uuid default null, p_limit int default 40) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('at', created_at, 'action', action, 'pseudo', target_pseudo, 'detail', detail) order by created_at desc), '[]'::jsonb) into r from
    (select * from public.admin_log where p_target is null or target_id = p_target order by created_at desc limit least(p_limit, 200)) q;
  return r;
end;
$$;
revoke all on function public.admin_log_list(uuid, int) from public, anon, authenticated;
grant execute on function public.admin_log_list(uuid, int) to authenticated;

-- La fiche joueur affiche aussi le solde enregistré et si le compte est admin
create or replace function public.admin_player(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  select jsonb_build_object(
    'id', p.id, 'pseudo', p.pseudo, 'email', u.email, 'created_at', p.created_at, 'last_seen', p.last_seen, 'last_sign_in', u.last_sign_in_at, 'flagged', p.flagged,
    'friend_code', p.friend_code, 'summary', p.summary,
    'cash', coalesce(((public._jb((select s.data ->> 'empire_clicker' from public.cloud_saves s where s.user_id = p.id))) ->> 'cash')::numeric, 0),
    'is_admin', exists (select 1 from public.admin_users a where a.user_id = p.id),
    'friends', (select count(*) from public.friendships f where (f.requester = p.id or f.target = p.id) and f.status = 'accepted'),
    'clan', (select jsonb_build_object('name', c.name, 'tag', c.tag, 'leader', c.leader = p.id) from public.clan_members m join public.clans c on c.id = m.clan_id where m.user_id = p.id),
    'flag_info', (select jsonb_build_object('n', f.n, 'reason', f.last_reason, 'at', f.last_at) from public.cheat_flags f where f.user_id = p.id),
    'history', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(day, 'YYYY-MM-DD'), 'level', level, 'cards', cards, 'copies', copies, 'cash', cash, 'clicks', clicks, 'packs', packs, 'lp', lp) order by day)
        from (select * from public.player_stats_daily where user_id = p.id order by day desc limit 120) q), '[]'::jsonb),
    'ratings', coalesce((select jsonb_agg(jsonb_build_object('game', game, 'season', season, 'lp', lp, 'wins', wins, 'losses', losses, 'draws', draws) order by season desc, game) from public.league_ratings where user_id = p.id), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(jsonb_build_object('at', created_at, 'game', game, 'result', result, 'mode', mode, 'delta', delta) order by created_at desc) from
        (select * from public.league_log where user_id = p.id order by created_at desc limit 30) q), '[]'::jsonb)
  ) into r from public.profiles p join auth.users u on u.id = p.id where p.id = p_id;
  return r;
end;
$$;
revoke all on function public.admin_player(uuid) from public, anon, authenticated;
grant execute on function public.admin_player(uuid) to authenticated;
