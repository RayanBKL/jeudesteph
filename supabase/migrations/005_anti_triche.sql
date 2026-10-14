-- ============================================================
-- THE ASHTRAY KING — Migration 005 : anti-triche et limites de fréquence
-- ============================================================

alter table public.profiles add column if not exists flagged boolean not null default false;

create table if not exists public.cheat_flags (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  n int not null default 0,
  last_reason text,
  last_at timestamptz not null default now()
);
alter table public.cheat_flags enable row level security;
revoke all on public.cheat_flags from anon, authenticated;

create table if not exists public.rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  window_start timestamptz not null default now(),
  n int not null default 0,
  primary key (user_id, key)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Limite de fréquence par joueur : _rl('clé', max d'appels, fenêtre en secondes)
create or replace function public._rl(p_key text, p_max int, p_secs int) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r public.rate_limits%rowtype;
begin
  if uid is null then return; end if;
  insert into public.rate_limits as t (user_id, key, window_start, n) values (uid, p_key, now(), 1)
  on conflict (user_id, key) do update set
    n = case when t.window_start < now() - make_interval(secs => p_secs) then 1 else t.n + 1 end,
    window_start = case when t.window_start < now() - make_interval(secs => p_secs) then now() else t.window_start end
  returning * into r;
  if r.n > p_max then raise exception 'Trop de requêtes, patiente un peu'; end if;
end;
$$;
revoke all on function public._rl(text, int, int) from public, anon, authenticated;

-- Sauvegarde en ligne : on vérifie que la progression est plausible (vitesse de clics, paquets, cartes)
create or replace function public.cloud_save_put(p_data jsonb, p_base timestamptz default null, p_device text default null, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur timestamptz; old_data jsonb;
  ts timestamptz := clock_timestamp();
  clicker jsonb; empire jsonb; prest jsonb; oclicker jsonb; oempire jsonb;
  cards int := 0; copies int := 0; ocopies int := 0; troph jsonb := '{}'::jsonb; lvl int := 1;
  elapsed numeric; dclk numeric; dpk numeric; npk numeric; opk numeric; nclk numeric; oclk numeric; reason text; k text; v numeric; flags int; catalog int;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('save', 30, 60);
  select updated_at, data into cur, old_data from public.cloud_saves where user_id = uid for update;
  if found and not p_force and (p_base is null or cur > p_base) then
    return jsonb_build_object('ok', false, 'conflict', true, 'updated_at', cur);
  end if;

  begin
    clicker := (p_data ->> 'empire_clicker')::jsonb;
    empire := (p_data ->> 'empire_state')::jsonb;
    prest := (p_data ->> 'prestige_v1')::jsonb;
    lvl := coalesce((clicker ->> 'empireLevel')::int, 1);
    select count(*) filter (where value::numeric > 0), coalesce(sum(value::numeric) filter (where value::numeric > 0), 0)
      into cards, copies from jsonb_each_text(coalesce(empire -> 'inventory', '{}'::jsonb));
    select coalesce(jsonb_object_agg(tier, n), '{}'::jsonb) into troph
      from (select t ->> 'tier' as tier, count(*) as n from jsonb_array_elements(coalesce(prest -> 'trophies', '[]'::jsonb)) t group by 1) s;
  exception when others then reason := 'format';
  end;

  -- Contrôles de plausibilité
  if reason is null and clicker is not null then
    foreach k in array array['cash', 'totalEarned', 'totalClicks', 'empireLevel', 'empireXP'] loop
      v := coalesce((clicker ->> k)::numeric, 0);
      if v < 0 or v > 1e15 then reason := 'valeur ' || k; end if;
    end loop;
    select count(*) into catalog from public.card_catalog;
    if lvl > 300 or cards > catalog then reason := coalesce(reason, 'niveau ou cartes impossibles'); end if;
    nclk := coalesce((clicker ->> 'totalClicks')::numeric, 0);
    npk := coalesce((empire ->> 'totalPacksOpened')::numeric, 0);
    if old_data is not null and cur is not null then
      begin
        oclicker := (old_data ->> 'empire_clicker')::jsonb; oempire := (old_data ->> 'empire_state')::jsonb;
        oclk := coalesce((oclicker ->> 'totalClicks')::numeric, 0);
        opk := coalesce((oempire ->> 'totalPacksOpened')::numeric, 0);
        select coalesce(sum(value::numeric) filter (where value::numeric > 0), 0) into ocopies from jsonb_each_text(coalesce(oempire -> 'inventory', '{}'::jsonb));
        elapsed := greatest(extract(epoch from (ts - cur)), 1);
        dclk := nclk - oclk; dpk := npk - opk;
        if dclk > 60 * elapsed + 500 then reason := coalesce(reason, 'vitesse de clics'); end if;
        if dpk > elapsed / 0.4 + 100 then reason := coalesce(reason, 'vitesse d''ouverture de paquets'); end if;
        if (copies - ocopies) > 8 * greatest(dpk, 0) + 150 then reason := coalesce(reason, 'cartes sans paquets'); end if;
      exception when others then null;
      end;
    else
      if nclk > 3000000 or copies > 20 * npk + 2500 then reason := coalesce(reason, 'première sauvegarde incohérente'); end if;
    end if;
  end if;

  if reason is not null then
    insert into public.cheat_flags as f (user_id, n, last_reason, last_at) values (uid, 1, reason, now())
    on conflict (user_id) do update set n = f.n + 1, last_reason = excluded.last_reason, last_at = now()
    returning n into flags;
    if flags >= 3 then update public.profiles set flagged = true where id = uid; end if;
    return jsonb_build_object('ok', false, 'rejected', true, 'reason', reason);
  end if;

  insert into public.cloud_saves (user_id, data, device, updated_at) values (uid, p_data, p_device, ts)
  on conflict (user_id) do update set data = excluded.data, device = excluded.device, updated_at = excluded.updated_at;

  update public.profiles
     set summary = jsonb_build_object('level', lvl, 'cards', cards, 'copies', copies, 'trophies', troph), last_seen = now()
   where id = uid;

  return jsonb_build_object('ok', true, 'updated_at', ts);
end;
$$;
revoke all on function public.cloud_save_put(jsonb, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.cloud_save_put(jsonb, timestamptz, text, boolean) to authenticated;

-- Les comptes signalés ne figurent plus au classement des collectionneurs
create or replace function public.get_collectors(p_limit int default 50)
returns table (pos bigint, user_id uuid, pseudo text, avatar_small text, cards int, level int)
language sql security definer set search_path = public stable as $$
  select row_number() over (order by coalesce((p.summary ->> 'cards')::int, 0) desc), p.id, p.pseudo, p.avatar_small,
         coalesce((p.summary ->> 'cards')::int, 0), coalesce((p.summary ->> 'level')::int, 1)
    from public.profiles p
   where coalesce((p.summary ->> 'cards')::int, 0) > 0 and not p.flagged
   order by coalesce((p.summary ->> 'cards')::int, 0) desc
   limit least(coalesce(p_limit, 50), 100);
$$;
revoke all on function public.get_collectors(int) from public, anon, authenticated;
grant execute on function public.get_collectors(int) to authenticated;


create or replace function public.friend_request(p_who text)
returns jsonb language plpgsql security definer set search_path = public as $$
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
  return jsonb_build_object('status', 'pending');
end;
$$;

revoke all on function public.friend_request(text) from public, anon, authenticated;
grant execute on function public.friend_request(text) to authenticated;

create or replace function public.clan_create(p_name text, p_tag text, p_descr text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  perform public._rl('clan_create', 5, 3600);
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

revoke all on function public.clan_create(text,text,text) from public, anon, authenticated;
grant execute on function public.clan_create(text,text,text) to authenticated;

create or replace function public.invite_send(p_friend uuid, p_game text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); iid uuid;
begin
  perform public._rl('invite', 30, 600);
  if uid is null then raise exception 'Non connecté'; end if;
  if p_game not in ('pbc', 'des421', 'quiz') then raise exception 'Jeu inconnu'; end if;
  if not public._are_friends(uid, p_friend) then raise exception 'Ce joueur n''est pas dans tes amis'; end if;
  update public.game_invites set status = 'cancelled' where from_user = uid and status = 'pending';
  insert into public.game_invites (from_user, to_user, game) values (uid, p_friend, p_game) returning id into iid;
  return iid;
end;
$$;

revoke all on function public.invite_send(uuid,text) from public, anon, authenticated;
grant execute on function public.invite_send(uuid,text) to authenticated;

create or replace function public.mm_join(p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); other public.matchmaking_queue%rowtype; mid uuid;
begin
  perform public._rl('mm', 200, 60);
  if uid is null then raise exception 'Non connecté'; end if;
  if p_game not in ('pbc', 'des421', 'quiz') then raise exception 'Jeu inconnu'; end if;
  delete from public.matchmaking_queue where joined_at < now() - interval '30 seconds';
  select id into mid from public.matches where status = 'active' and game = p_game and (p1 = uid or p2 = uid) order by created_at desc limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = uid;
    return jsonb_build_object('match_id', mid);
  end if;
  select * into other from public.matchmaking_queue where game = p_game and user_id <> uid order by joined_at limit 1 for update skip locked;
  if found then
    delete from public.matchmaking_queue where user_id in (uid, other.user_id);
    mid := public._create_match(p_game, other.user_id, uid);
    return jsonb_build_object('match_id', mid);
  end if;
  insert into public.matchmaking_queue (user_id, game, joined_at) values (uid, p_game, now())
    on conflict (user_id) do update set game = excluded.game, joined_at = now();
  return jsonb_build_object('waiting', true);
end;
$$;

revoke all on function public.mm_join(text) from public, anon, authenticated;
grant execute on function public.mm_join(text) to authenticated;
