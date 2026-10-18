-- ============================================================
-- THE ASHTRAY KING — Migration 016 : rôles de clan, défis entre membres, échanges de cartes privés
-- Rôles : chef (celui qui a créé le clan) > co-chef > ancien > membre.
--   chef     : tout (promouvoir / rétrograder, passer la main, exclure, régler le clan)
--   co-chef  : régler le clan, exclure les anciens et les membres, traiter les demandes
--   ancien   : traiter les demandes d'entrée
-- Échanges : une carte contre une carte, entre amis. La carte proposée est mise de côté (comme une annonce du marché),
--   la carte de l'autre arrive par un « crédit » (account_grants) appliqué à sa prochaine synchronisation.
-- ============================================================
alter table public.clan_members add column if not exists role text not null default 'membre';
alter table public.clan_members drop constraint if exists clan_members_role_check;
alter table public.clan_members add constraint clan_members_role_check check (role in ('membre', 'ancien', 'colead'));

create or replace function public._clan_role(p_uid uuid) returns text language sql stable security definer set search_path = public as $$
  select case when c.leader = p_uid then 'chef' else m.role end
    from public.clan_members m join public.clans c on c.id = m.clan_id where m.user_id = p_uid;
$$;
revoke all on function public._clan_role(uuid) from public, anon, authenticated;

create or replace function public._role_rank(r text) returns int language sql immutable as $$
  select case r when 'chef' then 3 when 'colead' then 2 when 'ancien' then 1 else 0 end;
$$;
revoke all on function public._role_rank(text) from public, anon, authenticated;

create or replace function public._same_clan(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clan_members x join public.clan_members y on y.clan_id = x.clan_id where x.user_id = a and y.user_id = b and a <> b);
$$;
revoke all on function public._same_clan(uuid, uuid) from public, anon, authenticated;

-- Défis : amis OU membres du même clan
create or replace function public.invite_send(p_friend uuid, p_game text) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); iid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('invite', 30, 600);
  if p_game not in ('pbc', 'des421', 'quiz', 'bataille', 'course') then raise exception 'Jeu inconnu'; end if;
  if not (public._are_friends(uid, p_friend) or public._same_clan(uid, p_friend)) then raise exception 'Ce joueur n''est ni ton ami ni dans ton clan'; end if;
  update public.game_invites set status = 'cancelled' where from_user = uid and status = 'pending';
  insert into public.game_invites (from_user, to_user, game) values (uid, p_friend, p_game) returning id into iid;
  return iid;
end;
$$;
revoke all on function public.invite_send(uuid, text) from public, anon, authenticated;
grant execute on function public.invite_send(uuid, text) to authenticated;

-- Changer le rôle d'un membre (chef seulement)
create or replace function public.clan_set_role(p_user uuid, p_role text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('clan_admin', 60, 600);
  if p_role not in ('membre', 'ancien', 'colead') then raise exception 'Rôle inconnu'; end if;
  select id into cid from public.clans where leader = uid;
  if cid is null then raise exception 'Seul le chef peut changer les rôles'; end if;
  if p_user = uid then raise exception 'Le chef reste chef'; end if;
  if not exists (select 1 from public.clan_members where user_id = p_user and clan_id = cid) then raise exception 'Ce joueur n''est pas dans ton clan'; end if;
  if p_role = 'colead' and (select count(*) from public.clan_members where clan_id = cid and role = 'colead' and user_id <> p_user) >= 3 then raise exception '3 co-chefs maximum'; end if;
  if p_role = 'ancien' and (select count(*) from public.clan_members where clan_id = cid and role = 'ancien' and user_id <> p_user) >= 8 then raise exception '8 anciens maximum'; end if;
  update public.clan_members set role = p_role where user_id = p_user and clan_id = cid;
end;
$$;
revoke all on function public.clan_set_role(uuid, text) from public, anon, authenticated;
grant execute on function public.clan_set_role(uuid, text) to authenticated;

-- Passer la main : le chef devient co-chef
create or replace function public.clan_transfer(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('clan_admin', 60, 600);
  select id into cid from public.clans where leader = uid for update;
  if cid is null then raise exception 'Seul le chef peut passer la main'; end if;
  if p_user = uid or not exists (select 1 from public.clan_members where user_id = p_user and clan_id = cid) then raise exception 'Choisis un membre de ton clan'; end if;
  update public.clans set leader = p_user where id = cid;
  update public.clan_members set role = 'membre' where user_id = p_user;
  update public.clan_members set role = 'colead' where user_id = uid;
end;
$$;
revoke all on function public.clan_transfer(uuid) from public, anon, authenticated;
grant execute on function public.clan_transfer(uuid) to authenticated;

-- Exclure : on ne peut exclure que plus bas que soi, et seulement chef / co-chef
create or replace function public.clan_kick(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mine text; theirs text;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if p_user = uid then raise exception 'Utilise « Quitter »'; end if;
  mine := public._clan_role(uid);
  if mine not in ('chef', 'colead') then raise exception 'Tu n''as pas le droit d''exclure'; end if;
  if (select clan_id from public.clan_members where user_id = uid) is distinct from (select clan_id from public.clan_members where user_id = p_user) then raise exception 'Ce joueur n''est pas dans ton clan'; end if;
  theirs := public._clan_role(p_user);
  if public._role_rank(theirs) >= public._role_rank(mine) then raise exception 'Tu ne peux pas exclure quelqu''un de ton rang ou au-dessus'; end if;
  delete from public.clan_members where user_id = p_user;
end;
$$;
revoke all on function public.clan_kick(uuid) from public, anon, authenticated;
grant execute on function public.clan_kick(uuid) to authenticated;

-- Réglages du clan : chef et co-chefs
create or replace function public.clan_set(p_descr text, p_open boolean) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if public._clan_role(uid) not in ('chef', 'colead') then raise exception 'Réservé au chef et aux co-chefs'; end if;
  update public.clans set descr = left(regexp_replace(coalesce(p_descr, ''), '[[:cntrl:]]', ' ', 'g'), 140), open = coalesce(p_open, open)
   where id = (select clan_id from public.clan_members where user_id = uid);
end;
$$;
revoke all on function public.clan_set(text, boolean) from public, anon, authenticated;
grant execute on function public.clan_set(text, boolean) to authenticated;

-- Demandes d'entrée : chef, co-chefs et anciens
create or replace function public.clan_requests_list() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; cid uuid;
begin
  if auth.uid() is null or public._role_rank(public._clan_role(auth.uid())) < 1 then return '[]'::jsonb; end if;
  select clan_id into cid from public.clan_members where user_id = auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'pseudo', p.pseudo, 'avatar_small', p.avatar_small, 'level', coalesce((p.summary ->> 'level')::int, 1), 'at', q.created_at) order by q.created_at), '[]'::jsonb) into r
    from public.clan_requests q join public.profiles p on p.id = q.user_id where q.clan_id = cid;
  return r;
end;
$$;
revoke all on function public.clan_requests_list() from public, anon, authenticated;
grant execute on function public.clan_requests_list() to authenticated;

create or replace function public.clan_respond(p_user uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('clan_admin', 60, 600);
  if public._role_rank(public._clan_role(uid)) < 1 then raise exception 'Réservé au chef, aux co-chefs et aux anciens'; end if;
  select clan_id into cid from public.clan_members where user_id = uid;
  perform 1 from public.clans where id = cid for update;
  if not exists (select 1 from public.clan_requests where user_id = p_user and clan_id = cid) then raise exception 'Demande introuvable'; end if;
  if p_accept then
    if exists (select 1 from public.clan_members where user_id = p_user) then
      delete from public.clan_requests where user_id = p_user; raise exception 'Ce joueur a déjà rejoint un autre clan';
    end if;
    if (select count(*) from public.clan_members where clan_id = cid) >= 30 then raise exception 'Clan complet (30 membres)'; end if;
    insert into public.clan_members (user_id, clan_id) values (p_user, cid);
    delete from public.clan_requests where user_id = p_user;
  else
    delete from public.clan_requests where user_id = p_user and clan_id = cid;
  end if;
end;
$$;
revoke all on function public.clan_respond(uuid, boolean) from public, anon, authenticated;
grant execute on function public.clan_respond(uuid, boolean) to authenticated;

-- Quitter : si c'est le chef, la main passe au meilleur rang (co-chef, puis ancien, puis le plus ancien membre)
create or replace function public.clan_leave() returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.clans%rowtype; nxt uuid;
begin
  select cl.* into c from public.clans cl join public.clan_members m on m.clan_id = cl.id where m.user_id = uid for update of cl;
  if not found then return; end if;
  delete from public.clan_members where user_id = uid;
  if c.leader = uid then
    select user_id into nxt from public.clan_members where clan_id = c.id
     order by (case role when 'colead' then 2 when 'ancien' then 1 else 0 end) desc, joined_at limit 1;
    if nxt is null then delete from public.clans where id = c.id;
    else update public.clans set leader = nxt where id = c.id; update public.clan_members set role = 'membre' where user_id = nxt; end if;
  end if;
end;
$$;
revoke all on function public.clan_leave() from public, anon, authenticated;
grant execute on function public.clan_leave() to authenticated;

create or replace function public.clan_mine() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.clans%rowtype; mem jsonb; me text;
begin
  select cl.* into c from public.clans cl join public.clan_members m on m.clan_id = cl.id where m.user_id = uid;
  if not found then return null; end if;
  me := public._clan_role(uid);
  select coalesce(jsonb_agg(x.j order by x.rk desc, x.lp desc), '[]'::jsonb) into mem from (
    select jsonb_build_object('user_id', p.id, 'pseudo', p.pseudo, 'avatar_small', p.avatar_small, 'level', coalesce((p.summary ->> 'level')::int, 1),
             'lp', coalesce((select sum(r.lp) from public.league_ratings r where r.user_id = p.id and r.season = public.current_season()), 0),
             'online', p.last_seen > now() - interval '90 seconds', 'leader', p.id = c.leader,
             'role', case when p.id = c.leader then 'chef' else m.role end) as j,
           public._role_rank(case when p.id = c.leader then 'chef' else m.role end) as rk,
           coalesce((select sum(r.lp) from public.league_ratings r where r.user_id = p.id and r.season = public.current_season()), 0) as lp
      from public.clan_members m join public.profiles p on p.id = m.user_id where m.clan_id = c.id) x;
  return jsonb_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'descr', c.descr, 'open', c.open, 'leader', c.leader, 'me_leader', c.leader = uid, 'me_role', me,
    'members', mem, 'rank', (select s.pos from public.clan_search('') s where s.id = c.id),
    'requests', case when public._role_rank(me) >= 1 then (select count(*) from public.clan_requests q where q.clan_id = c.id) else 0 end);
end;
$$;
revoke all on function public.clan_mine() from public, anon, authenticated;
grant execute on function public.clan_mine() to authenticated;

-- ============================================================
-- Échanges de cartes entre amis
-- ============================================================
alter table public.account_grants add column if not exists card_id text;

create or replace function public.my_grants() returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  with g as (update public.account_grants set applied_at = now() where user_id = auth.uid() and applied_at is null returning mode, amount, note, kind, card_id, created_at)
  select coalesce(jsonb_agg(jsonb_build_object('mode', mode, 'amount', amount, 'note', note, 'kind', kind, 'card', card_id) order by created_at), '[]'::jsonb) into r from g;
  return r;
end;
$$;
revoke all on function public.my_grants() from public, anon, authenticated;
grant execute on function public.my_grants() to authenticated;

create table if not exists public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  give_card text not null references public.card_catalog(id),
  want_card text not null references public.card_catalog(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check (from_user <> to_user)
);
create index if not exists trade_offers_to on public.trade_offers (to_user, status);
create index if not exists trade_offers_from on public.trade_offers (from_user, status);
alter table public.trade_offers enable row level security;
revoke all on public.trade_offers from anon, authenticated;

-- exemplaires d'une carte dans la dernière sauvegarde du joueur (les cartes mises de côté en sont déjà retirées par le jeu)
create or replace function public._free_copies(p_uid uuid, p_card text) returns numeric language plpgsql stable security definer set search_path = public as $$
declare inv jsonb; have numeric;
begin
  begin select (data ->> 'empire_state')::jsonb -> 'inventory' into inv from public.cloud_saves where user_id = p_uid;
  exception when others then inv := null; end;
  have := coalesce((inv ->> p_card)::numeric, 0);
  return have;
end;
$$;
revoke all on function public._free_copies(uuid, text) from public, anon, authenticated;

create or replace function public.trade_propose(p_to uuid, p_give text, p_want text) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); tid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('trade', 20, 600);
  if not public._are_friends(uid, p_to) then raise exception 'Les échanges se font entre amis'; end if;
  if not exists (select 1 from public.card_catalog where id = p_give) or not exists (select 1 from public.card_catalog where id = p_want) then raise exception 'Carte inconnue'; end if;
  if (select count(*) from public.trade_offers where from_user = uid and status = 'pending') >= 5 then raise exception '5 échanges en attente maximum'; end if;
  if (select count(*) from public.trade_offers where to_user = p_to and from_user = uid and status = 'pending') >= 2 then raise exception 'Tu as déjà proposé des échanges à ce joueur'; end if;
  -- la sauvegarde du joueur doit contenir la carte (le jeu l'envoie juste avant)
  if public._free_copies(uid, p_give) < 1 then
    raise exception 'Cette carte n''est pas (encore) dans ta sauvegarde : réessaie dans quelques secondes';
  end if;
  insert into public.trade_offers (from_user, to_user, give_card, want_card) values (uid, p_to, p_give, p_want) returning id into tid;
  return tid;
end;
$$;
revoke all on function public.trade_propose(uuid, text, text) from public, anon, authenticated;
grant execute on function public.trade_propose(uuid, text, text) to authenticated;

create or replace function public.trade_list() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); r jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'give', t.give_card, 'want', t.want_card, 'at', t.created_at,
           'mine', t.from_user = uid, 'other_id', o.id, 'other', o.pseudo) order by t.created_at desc), '[]'::jsonb) into r
    from public.trade_offers t join public.profiles o on o.id = case when t.from_user = uid then t.to_user else t.from_user end
   where t.status = 'pending' and (t.from_user = uid or t.to_user = uid);
  return r;
end;
$$;
revoke all on function public.trade_list() from public, anon, authenticated;
grant execute on function public.trade_list() to authenticated;

-- L'expéditeur reprend sa carte : le jeu la remet tout de suite dans son inventaire
create or replace function public.trade_cancel(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare t public.trade_offers%rowtype;
begin
  select * into t from public.trade_offers where id = p_id and from_user = auth.uid() for update;
  if not found or t.status <> 'pending' then raise exception 'Cet échange n''est plus disponible'; end if;
  update public.trade_offers set status = 'cancelled', closed_at = now() where id = p_id;
  return t.give_card;
end;
$$;
revoke all on function public.trade_cancel(uuid) from public, anon, authenticated;
grant execute on function public.trade_cancel(uuid) to authenticated;

-- Le destinataire refuse : la carte revient à l'expéditeur à sa prochaine synchronisation
create or replace function public.trade_decline(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.trade_offers%rowtype; cname text;
begin
  select * into t from public.trade_offers where id = p_id and to_user = auth.uid() for update;
  if not found or t.status <> 'pending' then raise exception 'Cet échange n''est plus disponible'; end if;
  update public.trade_offers set status = 'declined', closed_at = now() where id = p_id;
  select name into cname from public.card_catalog where id = t.give_card;
  insert into public.account_grants (user_id, mode, amount, note, kind, card_id) values (t.from_user, 'add', 0, 'Échange refusé : ' || coalesce(cname, t.give_card) || ' te revient', 'trade_back', t.give_card);
end;
$$;
revoke all on function public.trade_decline(uuid) from public, anon, authenticated;
grant execute on function public.trade_decline(uuid) to authenticated;

-- Le destinataire accepte : il doit posséder la carte demandée (sauvegarde à jour). Le jeu retire sa carte et ajoute celle reçue.
create or replace function public.trade_accept(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t public.trade_offers%rowtype; oname text;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('trade', 40, 600);
  select * into t from public.trade_offers where id = p_id and to_user = uid for update;
  if not found or t.status <> 'pending' then raise exception 'Cet échange n''est plus disponible'; end if;
  if not public._are_friends(uid, t.from_user) then raise exception 'Vous n''êtes plus amis'; end if;
  if public._free_copies(uid, t.want_card) < 1 then
    raise exception 'Tu n''as pas (ou plus) cette carte de libre';
  end if;
  update public.trade_offers set status = 'accepted', closed_at = now() where id = p_id;
  select pseudo into oname from public.profiles where id = uid;
  insert into public.account_grants (user_id, mode, amount, note, kind, card_id) values (t.from_user, 'add', 0, 'Échange accepté par ' || coalesce(oname, 'ton ami'), 'trade', t.want_card);
  return jsonb_build_object('give', t.want_card, 'get', t.give_card);
end;
$$;
revoke all on function public.trade_accept(uuid) from public, anon, authenticated;
grant execute on function public.trade_accept(uuid) to authenticated;

-- Les échanges sans réponse au bout de 7 jours : la carte revient à son propriétaire
create or replace function public._trade_expire() returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  for t in update public.trade_offers set status = 'expired', closed_at = now() where status = 'pending' and created_at < now() - interval '7 days' returning from_user, give_card loop
    insert into public.account_grants (user_id, mode, amount, note, kind, card_id) values (t.from_user, 'add', 0, 'Échange expiré : ta carte te revient', 'trade_back', t.give_card);
  end loop;
end;
$$;
revoke all on function public._trade_expire() from public, anon, authenticated;
select cron.unschedule('echanges-expiration') where exists (select 1 from cron.job where jobname = 'echanges-expiration');
select cron.schedule('echanges-expiration', '20 * * * *', $$select public._trade_expire()$$);
select cron.unschedule('echanges-nettoyage') where exists (select 1 from cron.job where jobname = 'echanges-nettoyage');
select cron.schedule('echanges-nettoyage', '40 1 * * *', $$delete from public.trade_offers where status <> 'pending' and closed_at < now() - interval '30 days'$$);
