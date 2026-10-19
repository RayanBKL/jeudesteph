-- ============================================================
-- THE ASHTRAY KING — Migration 026 : notifications push (Web Push)
-- Le navigateur (ou le raccourci installé sur le téléphone) s'abonne ; la base prévient l'appareil quand un ami invite / écrit, ou qu'un
-- paquet gratuit est prêt. L'envoi passe par la fonction Edge « push » (supabase/functions/push), appelée par pg_net avec un secret.
-- La configuration (adresse + secret) est dans la table push_config, qui n'est lisible par personne côté navigateur (jamais dans ce fichier).
-- On ne notifie que les joueurs HORS LIGNE (pas vus depuis 90 secondes) pour ne pas doubler ce qu'ils voient déjà à l'écran.
-- ============================================================
create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
create table if not exists public.push_config (id int primary key default 1 check (id = 1), url text not null, secret text not null);
create table if not exists public.push_state (user_id uuid primary key references public.profiles(id) on delete cascade, last_pack_notif timestamptz);
alter table public.push_subscriptions enable row level security;
alter table public.push_config enable row level security;
alter table public.push_state enable row level security;
revoke all on public.push_subscriptions, public.push_config, public.push_state from anon, authenticated;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('push_sub', 20, 3600);
  if p_endpoint !~ '^https://[^ ]{10,600}$' or p_p256dh !~ '^[A-Za-z0-9_-]{20,200}$' or p_auth !~ '^[A-Za-z0-9_-]{10,100}$' then raise exception 'Abonnement invalide'; end if;
  delete from public.push_subscriptions where user_id = uid and endpoint <> p_endpoint and id not in (select id from public.push_subscriptions where user_id = uid order by created_at desc limit 4);
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (uid, p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;
revoke all on function public.push_subscribe(text, text, text) from public, anon, authenticated;
grant execute on function public.push_subscribe(text, text, text) to authenticated;

create or replace function public.push_unsubscribe(p_endpoint text) returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where user_id = auth.uid() and endpoint = p_endpoint;
$$;
revoke all on function public.push_unsubscribe(text) from public, anon, authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;

-- Envoi (interne) : jamais d'erreur remontée à la fonction qui l'appelle
create or replace function public._push_notify(p_user uuid, p_title text, p_body text, p_tag text default 'ak') returns void language plpgsql security definer set search_path = public as $$
declare cfg public.push_config%rowtype;
begin
  if p_user is null then return; end if;
  if not exists (select 1 from public.push_subscriptions where user_id = p_user) then return; end if;
  if exists (select 1 from public.profiles where id = p_user and last_seen > now() - interval '90 seconds') then return; end if;
  select * into cfg from public.push_config where id = 1;
  if not found then return; end if;
  perform net.http_post(url := cfg.url, body := jsonb_build_object('user_ids', jsonb_build_array(p_user), 'title', p_title, 'body', p_body, 'url', '/', 'tag', p_tag),
                        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret));
exception when others then null;
end;
$$;
revoke all on function public._push_notify(uuid, text, text, text) from public, anon, authenticated;

-- Paquet gratuit prêt : une seule notification par absence (tant que le joueur n'est pas revenu)
create or replace function public._push_free_packs() returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select s.user_id
      from public.cloud_saves s join public.profiles p on p.id = s.user_id
      left join public.push_state st on st.user_id = s.user_id
     where exists (select 1 from public.push_subscriptions x where x.user_id = s.user_id)
       and (s.data ->> 'empire_next_free_pack_time') ~ '^[0-9]{10,14}$'
       and to_timestamp(((s.data ->> 'empire_next_free_pack_time')::numeric) / 1000) <= now()
       and coalesce(nullif(s.data ->> 'empire_free_packs_count', '')::numeric, 0) < 10
       and p.last_seen < now() - interval '3 minutes'
       and (st.last_pack_notif is null or st.last_pack_notif < p.last_seen)
  loop
    perform public._push_notify(r.user_id, 'Ton paquet gratuit est prêt', 'Viens l''ouvrir avant qu''il n''y en ait trop en stock.', 'free-pack');
    insert into public.push_state (user_id, last_pack_notif) values (r.user_id, now()) on conflict (user_id) do update set last_pack_notif = now();
  end loop;
end;
$$;
revoke all on function public._push_free_packs() from public, anon, authenticated;
select cron.unschedule('push-paquets') where exists (select 1 from cron.job where jobname = 'push-paquets');
select cron.schedule('push-paquets', '*/3 * * * *', $$select public._push_free_packs()$$);

-- Notifications déclenchées par les amis
CREATE OR REPLACE FUNCTION public.chat_send(p_scope text, p_target uuid, p_body text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); b text; cid uuid; mid bigint; a uuid; c uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('chat', 20, 60);
  b := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'));
  if char_length(b) < 1 then raise exception 'Message vide'; end if;
  if char_length(b) > 300 then raise exception 'Message trop long (300 caractères)'; end if;
  if p_scope = 'clan' then
    cid := public._my_clan();
    if cid is null then raise exception 'Tu n''es dans aucun clan'; end if;
    insert into public.chat_messages (scope, clan_id, sender, body) values ('clan', cid, uid, b) returning id into mid;
  elsif p_scope = 'dm' then
    if p_target is null or not public._are_friends(uid, p_target) then raise exception 'Vous n''êtes pas amis'; end if;
    a := least(uid, p_target); c := greatest(uid, p_target);
    insert into public.chat_messages (scope, user_a, user_b, sender, body) values ('dm', a, c, uid, b) returning id into mid;
    perform public._push_notify(p_target, (select pseudo from public.profiles where id = uid), left(b, 100), 'dm-' || uid::text);
  else raise exception 'Salon inconnu';
  end if;
  return mid;
end;
$function$
;
revoke all on function public.chat_send(text, uuid, text) from public, anon;
grant execute on function public.chat_send(text, uuid, text) to authenticated;
CREATE OR REPLACE FUNCTION public.friend_request(p_who text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); t uuid; ex public.friendships%rowtype; w text := trim(coalesce(p_who, ''));
begin
  perform public._rl('friend', 30, 3600);
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
  perform public._push_notify(t, 'Nouvelle demande d''ami', (select pseudo from public.profiles where id = uid) || ' veut devenir ton ami.', 'friend-' || uid::text);
  return jsonb_build_object('status', 'pending');
end;
$function$
;
revoke all on function public.friend_request(text) from public, anon;
grant execute on function public.friend_request(text) to authenticated;
CREATE OR REPLACE FUNCTION public.invite_send(p_friend uuid, p_game text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); iid uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('invite', 30, 600);
  if p_game not in ('pbc', 'des421', 'quiz', 'bataille', 'course') then raise exception 'Jeu inconnu'; end if;
  if not (public._are_friends(uid, p_friend) or public._same_clan(uid, p_friend)) then raise exception 'Ce joueur n''est ni ton ami ni dans ton clan'; end if;
  update public.game_invites set status = 'cancelled' where from_user = uid and status = 'pending';
  insert into public.game_invites (from_user, to_user, game) values (uid, p_friend, p_game) returning id into iid;
  perform public._push_notify(p_friend, (select pseudo from public.profiles where id = uid) || ' te défie', (case p_game when 'pbc' then 'Pierre-Briquet-Clope' when 'des421' then '421' when 'quiz' then 'Quiz du Comptoir' when 'bataille' then 'Bataille de Comptoir' else p_game end) || ' : ouvre le jeu pour accepter (2 minutes).', 'invite-' || uid::text);
  return iid;
end;
$function$
;
revoke all on function public.invite_send(uuid, text) from public, anon;
grant execute on function public.invite_send(uuid, text) to authenticated;
