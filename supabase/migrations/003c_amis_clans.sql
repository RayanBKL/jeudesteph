-- ============================================================
-- THE ASHTRAY KING — Migration 003c : amis, invitations de partie, clans
-- Tout passe par des fonctions serveur : le navigateur ne touche jamais aux tables.
-- ============================================================

create or replace function public.touch_presence() returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen = now() where id = auth.uid() and last_seen < now() - interval '30 seconds';
$$;
revoke all on function public.touch_presence() from public, anon, authenticated;
grant execute on function public.touch_presence() to authenticated;

-- ── Amis ──
create table if not exists public.friendships (
  requester uuid not null references public.profiles(id) on delete cascade,
  target uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> target)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, target), greatest(requester, target));
create index if not exists friendships_target on public.friendships (target);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

create or replace function public.friend_request(p_who text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t uuid; ex public.friendships%rowtype; w text := trim(coalesce(p_who, ''));
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select id into t from public.profiles where lower(pseudo) = lower(w) or upper(friend_code) = upper(w) limit 1;
  if t is null then raise exception 'Aucun joueur de ce nom'; end if;
  if t = uid then raise exception 'Tu ne peux pas t''ajouter toi-même'; end if;
  select * into ex from public.friendships where least(requester, target) = least(uid, t) and greatest(requester, target) = greatest(uid, t);
  if found then
    if ex.status = 'accepted' then raise exception 'Vous êtes déjà amis'; end if;
    if ex.requester = uid then raise exception 'Demande déjà envoyée'; end if;
    update public.friendships set status = 'accepted' where requester = t and target = uid;   -- il t'avait déjà demandé
    return jsonb_build_object('status', 'accepted');
  end if;
  if (select count(*) from public.friendships where requester = uid and status = 'pending') >= 30 then raise exception 'Trop de demandes en attente'; end if;
  if (select count(*) from public.friendships where (requester = uid or target = uid) and status = 'accepted') >= 100 then raise exception 'Liste d''amis pleine (100)'; end if;
  insert into public.friendships (requester, target) values (uid, t);
  return jsonb_build_object('status', 'pending');
end;
$$;

create or replace function public.friend_respond(p_other uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted' where requester = p_other and target = auth.uid() and status = 'pending';
  else
    delete from public.friendships where requester = p_other and target = auth.uid() and status = 'pending';
  end if;
end;
$$;

create or replace function public.friend_remove(p_other uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friendships where (requester = auth.uid() and target = p_other) or (requester = p_other and target = auth.uid());
$$;

create or replace function public.friends_list()
returns table (user_id uuid, pseudo text, avatar_small text, level int, online boolean, rel text)
language sql security definer set search_path = public stable as $$
  select p.id, p.pseudo, p.avatar_small, coalesce((p.summary ->> 'level')::int, 1), p.last_seen > now() - interval '90 seconds',
         case when f.status = 'accepted' then 'ami' when f.requester = auth.uid() then 'envoyee' else 'recue' end
    from public.friendships f
    join public.profiles p on p.id = case when f.requester = auth.uid() then f.target else f.requester end
   where auth.uid() in (f.requester, f.target)
   order by (f.status = 'accepted') desc, (p.last_seen > now() - interval '90 seconds') desc, lower(p.pseudo);
$$;

-- ── Invitations à jouer entre amis ──
create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('pbc', 'des421', 'quiz')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  match_id uuid,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists game_invites_to on public.game_invites (to_user, status);
alter table public.game_invites enable row level security;
revoke all on public.game_invites from anon, authenticated;

create or replace function public._are_friends(a uuid, b uuid) returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.friendships where status = 'accepted' and least(requester, target) = least(a, b) and greatest(requester, target) = greatest(a, b));
$$;
revoke all on function public._are_friends(uuid, uuid) from public, anon, authenticated;

create or replace function public.invite_send(p_friend uuid, p_game text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); iid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if p_game not in ('pbc', 'des421', 'quiz') then raise exception 'Jeu inconnu'; end if;
  if not public._are_friends(uid, p_friend) then raise exception 'Ce joueur n''est pas dans tes amis'; end if;
  update public.game_invites set status = 'cancelled' where from_user = uid and status = 'pending';
  insert into public.game_invites (from_user, to_user, game) values (uid, p_friend, p_game) returning id into iid;
  return iid;
end;
$$;

create or replace function public.invite_respond(p_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); inv public.game_invites%rowtype; mid uuid;
begin
  select * into inv from public.game_invites where id = p_id and to_user = uid and status = 'pending' and created_at > now() - interval '2 minutes' for update;
  if not found then raise exception 'Invitation expirée'; end if;
  if not p_accept then
    update public.game_invites set status = 'declined' where id = p_id;
    return jsonb_build_object('declined', true);
  end if;
  mid := public._create_match(inv.game, inv.from_user, uid);
  update public.game_invites set status = 'accepted', match_id = mid where id = p_id;
  return jsonb_build_object('match_id', mid);
end;
$$;

create or replace function public.invite_cancel(p_id uuid) returns void language sql security definer set search_path = public as $$
  update public.game_invites set status = 'cancelled' where id = p_id and from_user = auth.uid() and status = 'pending';
$$;

-- Mes invitations : reçues en attente + mes envoyées (avec le match une fois accepté)
create or replace function public.invites_get()
returns table (id uuid, direction text, game text, status text, match_id uuid, other uuid, other_pseudo text)
language sql security definer set search_path = public stable as $$
  select i.id, case when i.to_user = auth.uid() then 'recue' else 'envoyee' end, i.game, i.status, i.match_id,
         o.id, o.pseudo
    from public.game_invites i
    join public.profiles o on o.id = case when i.to_user = auth.uid() then i.from_user else i.to_user end
   where auth.uid() in (i.from_user, i.to_user) and i.created_at > now() - interval '2 minutes'
     and ((i.to_user = auth.uid() and i.status = 'pending') or (i.from_user = auth.uid()))
   order by i.created_at desc limit 10;
$$;

-- ── Clans ──
create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 24 and name ~ '^[[:alnum:] _.''-]+$'),
  tag text not null check (tag ~ '^[A-Z0-9]{2,4}$'),
  descr text not null default '' check (char_length(descr) <= 140),
  open boolean not null default true,
  leader uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists clans_name_uq on public.clans (lower(name));
create unique index if not exists clans_tag_uq on public.clans (tag);
create table if not exists public.clan_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  clan_id uuid not null references public.clans(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists clan_members_clan on public.clan_members (clan_id);
alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
revoke all on public.clans, public.clan_members from anon, authenticated;

create or replace function public.clan_create(p_name text, p_tag text, p_descr text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from public.clan_members where user_id = uid) then raise exception 'Tu es déjà dans un clan'; end if;
  begin
    insert into public.clans (name, tag, descr, leader) values (trim(p_name), upper(trim(p_tag)), left(coalesce(p_descr, ''), 140), uid) returning id into cid;
  exception when unique_violation then raise exception 'Ce nom ou ce tag est déjà pris';
            when check_violation then raise exception 'Nom (3 à 24 caractères) ou tag (2 à 4 lettres/chiffres) invalide';
  end;
  insert into public.clan_members (user_id, clan_id) values (uid, cid);
  return cid;
end;
$$;

create or replace function public.clan_join(p_clan uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.clans%rowtype;
begin
  if exists (select 1 from public.clan_members where user_id = uid) then raise exception 'Tu es déjà dans un clan'; end if;
  select * into c from public.clans where id = p_clan for update;
  if not found then raise exception 'Clan introuvable'; end if;
  if not c.open then raise exception 'Ce clan est fermé'; end if;
  if (select count(*) from public.clan_members where clan_id = c.id) >= 30 then raise exception 'Clan complet (30 membres)'; end if;
  insert into public.clan_members (user_id, clan_id) values (uid, c.id);
end;
$$;

create or replace function public.clan_leave() returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.clans%rowtype; nxt uuid;
begin
  select cl.* into c from public.clans cl join public.clan_members m on m.clan_id = cl.id where m.user_id = uid for update of cl;
  if not found then return; end if;
  delete from public.clan_members where user_id = uid;
  if c.leader = uid then
    select user_id into nxt from public.clan_members where clan_id = c.id order by joined_at limit 1;
    if nxt is null then delete from public.clans where id = c.id; else update public.clans set leader = nxt where id = c.id; end if;
  end if;
end;
$$;

create or replace function public.clan_kick(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if p_user = uid then raise exception 'Utilise « Quitter »'; end if;
  delete from public.clan_members m using public.clans c where m.user_id = p_user and m.clan_id = c.id and c.leader = uid;
end;
$$;

create or replace function public.clan_set(p_descr text, p_open boolean) returns void language sql security definer set search_path = public as $$
  update public.clans set descr = left(coalesce(p_descr, ''), 140), open = coalesce(p_open, open) where leader = auth.uid();
$$;

-- Classement et recherche de clans (points = somme des points de ligue de tous les membres sur la saison)
create or replace function public.clan_search(p_q text default '')
returns table (id uuid, name text, tag text, descr text, open boolean, members int, lp bigint, pos bigint)
language sql security definer set search_path = public stable as $$
  with t as (
    select c.id, c.name, c.tag, c.descr, c.open,
           (select count(*)::int from public.clan_members m where m.clan_id = c.id) as members,
           coalesce((select sum(r.lp) from public.clan_members m join public.league_ratings r on r.user_id = m.user_id and r.season = public.current_season() where m.clan_id = c.id), 0) as lp
      from public.clans c)
  select t.id, t.name, t.tag, t.descr, t.open, t.members, t.lp, row_number() over (order by t.lp desc, t.members desc)
    from t
   where coalesce(p_q, '') = '' or t.name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%' or t.tag = upper(p_q)
   order by t.lp desc, t.members desc limit 30;
$$;

create or replace function public.clan_mine()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare uid uuid := auth.uid(); c public.clans%rowtype; mem jsonb;
begin
  select cl.* into c from public.clans cl join public.clan_members m on m.clan_id = cl.id where m.user_id = uid;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'pseudo', p.pseudo, 'avatar_small', p.avatar_small, 'level', coalesce((p.summary ->> 'level')::int, 1),
           'lp', coalesce((select sum(r.lp) from public.league_ratings r where r.user_id = p.id and r.season = public.current_season()), 0),
           'online', p.last_seen > now() - interval '90 seconds', 'leader', p.id = c.leader)
           order by (p.id = c.leader) desc, coalesce((select sum(r.lp) from public.league_ratings r where r.user_id = p.id and r.season = public.current_season()), 0) desc), '[]'::jsonb)
    into mem from public.clan_members m join public.profiles p on p.id = m.user_id where m.clan_id = c.id;
  return jsonb_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'descr', c.descr, 'open', c.open, 'leader', c.leader, 'me_leader', c.leader = uid,
    'members', mem, 'rank', (select s.pos from public.clan_search('') s where s.id = c.id));
end;
$$;

do $$ declare f text; begin
  foreach f in array array['friend_request(text)', 'friend_respond(uuid,boolean)', 'friend_remove(uuid)', 'friends_list()', 'invite_send(uuid,text)', 'invite_respond(uuid,boolean)',
    'invite_cancel(uuid)', 'invites_get()', 'clan_create(text,text,text)', 'clan_join(uuid)', 'clan_leave()', 'clan_kick(uuid)', 'clan_set(text,boolean)', 'clan_search(text)', 'clan_mine()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Suppression d'un compte chef de clan : le plus ancien membre reprend, ou le clan disparaît
create or replace function public._clan_leader_gone() returns trigger language plpgsql security definer set search_path = public as $$
declare c record; nxt uuid;
begin
  for c in select id from public.clans where leader = old.id loop
    select m.user_id into nxt from public.clan_members m join public.profiles p on p.id = m.user_id where m.clan_id = c.id and m.user_id <> old.id order by m.joined_at limit 1;
    if nxt is null then delete from public.clans where id = c.id; else update public.clans set leader = nxt where id = c.id; end if;
  end loop;
  return old;
end;
$$;
drop trigger if exists clan_leader_gone on public.profiles;
create trigger clan_leader_gone before delete on public.profiles for each row execute function public._clan_leader_gone();
