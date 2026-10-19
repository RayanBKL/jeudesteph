-- ============================================================
-- THE ASHTRAY KING — Migration 018 : bots de secours (à la demande du porteur du projet)
-- Si personne n'est trouvé en 9-10 secondes, un bot du NIVEAU du joueur (10 paliers, de Mégot à Roi du Comptoir)
-- prend la place. Le serveur joue le bot avec les mêmes fonctions de coup que les humains (aucun avantage secret),
-- les points de ligue contre un bot sont plafonnés (Buraliste I, pas de bonus), 10 parties par jour et par bot.
-- Pas de faux acheteurs ni de faux vendeurs : les bots n'existent que dans les parties.
-- ============================================================
alter table public.profiles add column if not exists is_bot boolean not null default false;
alter table public.profiles add column if not exists bot_tier int;
alter table public.matches add column if not exists vs_bot boolean not null default false;
alter table public.matchmaking_queue add column if not exists since timestamptz not null default now();

update public.profiles set is_bot = true, bot_tier = t.n
  from (values ('Bot Mégot', 0), ('Bot Roulée', 1), ('Bot Blonde', 2), ('Bot Brune', 3), ('Bot Cigarillo', 4), ('Bot Havane', 5), ('Bot Buraliste', 6), ('Bot Baron', 7), ('Bot Parrain', 8), ('Bot Roi du Comptoir', 9)) as t(p, n)
 where profiles.pseudo = t.p;

-- Main de Bataille d'un bot : plus le palier est haut, plus les raretés montent
create or replace function public._bot_hand(p_tier int) returns text[] language plpgsql security definer set search_path = public as $$
declare rar text[] := array['commune', 'peu-commune', 'rare', 'epique', 'legendaire', 'mythique']; capi int := least(5, floor(p_tier * 0.6)::int); ids text[] := '{}'; i int; r int; c text;
begin
  for i in 1..5 loop
    r := greatest(0, capi - floor(random() * 2)::int);
    select id into c from public.card_catalog where rarity = rar[r + 1] and cps is not null and not (id = any(ids)) order by random() limit 1;
    if c is null then select id into c from public.card_catalog where rarity = 'commune' and cps is not null and not (id = any(ids)) order by random() limit 1; end if;
    ids := ids || c;
  end loop;
  return public._shuffle_ids(ids);
end;
$$;
revoke all on function public._bot_hand(int) from public, anon, authenticated;


-- fonctions modifiées
CREATE OR REPLACE FUNCTION public._finish_match(p_id uuid, p_winner uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m public.matches%rowtype; n int; r1 jsonb; r2 jsonb; res1 text; res2 text; new_status text := 'finished';
begin
  select * into m from public.matches where id = p_id for update;
  if not found or m.status <> 'active' then return; end if;
  if p_reason = 'abandon' then
    new_status := 'abandoned';
  else
    res1 := case when p_winner is null then 'draw' when p_winner = m.p1 then 'win' else 'loss' end;
    res2 := case when p_winner is null then 'draw' when p_winner = m.p2 then 'win' else 'loss' end;
    select count(*) into n from public.matches
     where status = 'finished' and game = m.game and created_at > now() - interval '24 hours'
       and ((p1 = m.p1 and p2 = m.p2) or (p1 = m.p2 and p2 = m.p1));
    if n < 10 then
      if m.vs_bot then
        -- contre un bot : points limités (plafond Buraliste I), jamais de bonus « vrai joueur »
        if exists (select 1 from public.profiles where id = m.p1 and is_bot) then r2 := public._league_apply(m.p2, m.game, res2, 'bot');
        else r1 := public._league_apply(m.p1, m.game, res1, 'bot'); end if;
      else
        r1 := public._league_apply(m.p1, m.game, res1, 'pvp');
        r2 := public._league_apply(m.p2, m.game, res2, 'pvp');
      end if;
    end if;
  end if;
  update public.matches
     set status = new_status, winner = p_winner, deadline = null, updated_at = now(),
         state = state || jsonb_build_object('finished', true, 'reason', p_reason, 'lp', jsonb_build_object('p1', r1, 'p2', r2))
   where id = p_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public._deal_hand(p_uid uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare inv jsonb; ids text[]; need int; bt int;
begin
  select bot_tier into bt from public.profiles where id = p_uid and is_bot;
  if found then return public._bot_hand(coalesce(bt, 0)); end if;
  begin
    select (data ->> 'empire_state')::jsonb -> 'inventory' into inv from public.cloud_saves where user_id = p_uid;
  exception when others then inv := null;
  end;
  select coalesce(array_agg(k), '{}') into ids from (
    select e.key as k from jsonb_each_text(coalesce(inv, '{}'::jsonb)) e join public.card_catalog c on c.id = e.key
     where e.value ~ '^[0-9]+$' and e.value::int > 0 and c.cps is not null order by random() limit 5) s;
  need := 5 - coalesce(cardinality(ids), 0);
  if need > 0 then
    ids := ids || coalesce((select array_agg(id) from (select id from public.card_catalog where rarity = 'commune' and cps is not null order by random() limit need) q), '{}');
  end if;
  return public._shuffle_ids(ids);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.match_get(p_match uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); m public.matches%rowtype; sec jsonb; mine jsonb := '{}'::jsonb;
begin
  perform public._bot_step(p_match);
  select * into m from public.matches where id = p_match;
  if not found or uid not in (m.p1, m.p2) then raise exception 'Match introuvable'; end if;
  select data into sec from public.match_secrets where match_id = m.id;
  if m.game = 'pbc' then mine := jsonb_build_object('move', sec -> 'moves' -> uid::text);
  elsif m.game = 'des421' then mine := jsonb_build_object('dice', sec -> 'dice' -> uid::text);
  elsif m.game = 'bataille' then mine := jsonb_build_object('hand', sec -> 'hands' -> uid::text, 'move', sec -> 'moves' -> uid::text);
  end if;
  return jsonb_build_object('id', m.id, 'game', m.game, 'status', m.status, 'p1', m.p1, 'p2', m.p2, 'me', case when uid = m.p1 then 0 else 1 end,
    'state', m.state, 'deadline', m.deadline, 'winner', m.winner, 'mine', mine, 'now', now());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mm_join(p_game text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); other public.matchmaking_queue%rowtype; mid uuid;
begin
  perform public._rl('mm', 200, 60);
  if uid is null then raise exception 'Non connecté'; end if;
  if p_game not in ('pbc', 'des421', 'quiz', 'bataille', 'course') then raise exception 'Jeu inconnu'; end if;
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
  insert into public.matchmaking_queue as q (user_id, game, joined_at, since) values (uid, p_game, now(), now())
    on conflict (user_id) do update set joined_at = now(), since = case when q.game = excluded.game then q.since else now() end, game = excluded.game;
  return jsonb_build_object('waiting', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ut_play(p_squad text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid(); quartier text[] := array['Kévin du City-Stade', 'Momo Petit-Pont', 'Dédé Grand-Pied', 'Le Neveu du Patron', 'Jojo Tacle-Glissé', 'Bébert Sans-Souffle', 'Sofiane Crochet', 'Le Facteur', 'Titi Pointu', 'Le Cousin de Gégé', 'Rachid Lucarne'];
  slots text[] := array['GB', 'DEF', 'DEF', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT', 'ATT'];
  inv jsonb; players jsonb := '[]'::jsonb; i int; cid text; c public.card_catalog%rowtype; my jsonb; opp public.ut_teams%rowtype; oev jsonb; opp_p jsonb;
  score int[] := array[0, 0]; events jsonb := '[]'::jsonb; mn int; ctrl numeric; side int; att jsonb; def jsonb; chance numeric; pgoal numeric; shooter text; res text; lp jsonb; recent int; atp jsonb; w numeric; x numeric; pn text; popp record;
  mev jsonb;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('ut', 40, 3600);
  if p_squad is null or cardinality(p_squad) <> 11 then raise exception 'Équipe invalide'; end if;
  begin
    select (data ->> 'empire_state')::jsonb -> 'inventory' into inv from public.cloud_saves where user_id = uid;
  exception when others then inv := null;
  end;
  for i in 1..11 loop
    cid := p_squad[i];
    if cid is null or cid = '' then
      players := players || jsonb_build_array(jsonb_build_object('name', quartier[i], 'pos', slots[i], 'ovr', 50, 'nat', '', 'clubs', '[]'::jsonb, 'q', true));
    else
      select * into c from public.card_catalog where card_catalog.id = cid and card_catalog.cat = 'foot' and card_catalog.pos is not null;
      if not found then raise exception 'Footballeur inconnu'; end if;
      if p_squad[1:11] is not null and (select count(*) from unnest(p_squad) z where z = cid) > 1 then raise exception 'Un joueur ne peut être placé qu''une fois'; end if;
      if coalesce((inv ->> cid)::numeric, 0) <= 0 then raise exception 'Une de tes cartes n''est pas encore synchronisée : réessaie dans quelques secondes'; end if;
      players := players || jsonb_build_array(jsonb_build_object('name', c.name, 'pos', c.pos, 'ovr', coalesce(c.ovr, 50), 'nat', coalesce(c.nat, ''), 'clubs', to_jsonb(c.clubs), 'q', false));
    end if;
  end loop;
  my := public._ut_eval(players);
  insert into public.ut_teams as t (user_id, players, ev, power, updated_at) values (uid, players, my, (my ->> 'power')::int, now())
    on conflict (user_id) do update set players = excluded.players, ev = excluded.ev, power = excluded.power, updated_at = now();

  select * into opp from (select * from public.ut_teams where user_id <> uid and updated_at > now() - interval '60 days' order by abs(power - (my ->> 'power')::int) limit 8) n order by random() limit 1;
  if not found then return jsonb_build_object('ok', true, 'no_opponent', true); end if;
  oev := opp.ev; opp_p := opp.players;
  select pseudo, avatar_small into popp from public.profiles where id = opp.user_id;

  for mn in select generate_series(5, 90, 5) loop
    ctrl := public._ut_sig(((my -> 'lines' ->> 'MIL')::numeric - (oev -> 'lines' ->> 'MIL')::numeric) / 8);
    side := case when random() < ctrl then 0 else 1 end;
    if side = 0 then att := my; atp := players; def := oev; else att := oev; atp := opp_p; def := my; end if;
    chance := 0.42 + ((att -> 'lines' ->> 'ATT')::numeric - (def -> 'lines' ->> 'DEF')::numeric) / 60;
    if random() < chance then
      -- tireur choisi selon le poste (attaquants d'abord)
      x := 0; for i in 1..11 loop x := x + case slots[i] when 'ATT' then 5 when 'MIL' then 2 when 'DEF' then 0.6 else 0.02 end; end loop;
      x := random() * x; pn := atp -> 0 ->> 'name';
      for i in 1..11 loop
        x := x - case slots[i] when 'ATT' then 5 when 'MIL' then 2 when 'DEF' then 0.6 else 0.02 end;
        if x <= 0 then pn := atp -> (i - 1) ->> 'name'; exit; end if;
      end loop;
      pgoal := 0.26 * public._ut_sig(((att -> 'lines' ->> 'ATT')::numeric - ((def -> 'lines' ->> 'DEF')::numeric * 0.5 + (def -> 'lines' ->> 'GB')::numeric * 0.5)) / 6) * 1.6;
      if random() < pgoal then
        score[side + 1] := score[side + 1] + 1;
        events := events || jsonb_build_array(jsonb_build_object('m', mn, 't', 'goal', 's', side, 'n', pn));
      else
        events := events || jsonb_build_array(jsonb_build_object('m', mn, 't', 'miss', 's', side, 'n', pn));
      end if;
    elsif random() < 0.35 then
      events := events || jsonb_build_array(jsonb_build_object('m', mn, 't', 'calm', 's', side));
    end if;
  end loop;
  res := case when score[1] > score[2] then 'win' when score[1] < score[2] then 'loss' else 'draw' end;
  select count(*) into recent from public.ut_matches where user_id = uid and opp_id = opp.user_id and created_at > now() - interval '24 hours';
  insert into public.ut_matches (user_id, opp_id) values (uid, opp.user_id);
  if recent < 3 then lp := public._league_apply(uid, 'ut', res, case when exists (select 1 from public.profiles where id = opp.user_id and is_bot) then 'bot' else 'pvp' end); end if;
  return jsonb_build_object('ok', true, 'no_opponent', false, 'me', my, 'opp', jsonb_build_object('pseudo', popp.pseudo, 'avatar_small', popp.avatar_small, 'ev', oev),
    'score', to_jsonb(score), 'events', events, 'result', res, 'lp', lp);
end;
$function$
;


-- Le bot joue : appelé à chaque lecture du match (le jeu lit toutes les secondes). Il ne joue qu'après un délai « humain ».
create or replace function public._bot_step(p_match uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  m public.matches%rowtype; b uuid; tier int; bi int; skill numeric; st jsonb; sec jsonb; since numeric; orig text;
  rolls int; d int[]; keep boolean[]; seen int[]; i int; sc numeric; idx int; hand jsonb; stat text; best numeric; v numeric; k int;
  qi int; qn jsonb; ch int; nch int; startt timestamptz; bt numeric; taps numeric[]; el numeric; c numeric; dist numeric;
begin
  if coalesce(current_setting('app.in_bot', true), '') = '1' then return; end if;
  select * into m from public.matches where id = p_match;
  if not found or m.status <> 'active' or not m.vs_bot then return; end if;
  select id, bot_tier into b, tier from public.profiles where id in (m.p1, m.p2) and is_bot limit 1;
  if b is null then return; end if;
  bi := case when b = m.p1 then 0 else 1 end;
  skill := 0.30 + coalesce(tier, 0) * 0.07;
  st := m.state; select data into sec from public.match_secrets where match_id = m.id;
  since := extract(epoch from (clock_timestamp() - m.updated_at));
  orig := coalesce(current_setting('request.jwt.claim.sub', true), '');
  perform set_config('app.in_bot', '1', true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  begin
    if m.game = 'pbc' then
      if not (st -> 'locked' ->> bi)::boolean and since >= 1.5 + (abs(hashtext(m.id::text || (st ->> 'round'))) % 30) / 10.0 then
        perform public.pbc_move(m.id, (array['pierre', 'briquet', 'clope'])[1 + floor(random() * 3)::int]);
      end if;

    elsif m.game = 'des421' then
      if not (st -> 'done' ->> bi)::boolean and since >= 1.8 then
        rolls := (st -> 'rolls' ->> bi)::int;
        if rolls = 0 then
          perform public.d421_roll(m.id, '{false,false,false}');
        else
          select array_agg(x::int) into d from jsonb_array_elements_text(sec -> 'dice' -> b::text) x;
          sc := public._d421_score(d);
          if sc >= 500 or (rolls >= 2 and sc >= 52) then
            perform public.d421_stop(m.id);
          else
            keep := '{false,false,false}'; seen := '{}';
            for i in 1..3 loop
              if d[i] in (1, 2, 4) and not (d[i] = any(seen)) then keep[i] := true; seen := seen || d[i]; end if;
            end loop;
            if random() > skill + 0.25 then keep := '{false,false,false}'; end if;
            perform public.d421_roll(m.id, keep);
          end if;
        end if;
      end if;

    elsif m.game = 'quiz' then
      if not (st -> 'answered' ->> bi)::boolean
         and extract(epoch from (clock_timestamp() - (st ->> 'started_at')::timestamptz)) >= 2.5 + (1 - skill) * 5 + (abs(hashtext(m.id::text || (st ->> 'i'))) % 20) / 10.0 then
        qi := (st ->> 'i')::int; qn := sec -> 'questions' -> qi; nch := jsonb_array_length(qn -> 'choices');
        if random() < 0.35 + coalesce(tier, 0) * 0.065 then ch := (qn ->> 'answer')::int; else ch := floor(random() * nch)::int; end if;
        perform public.quiz_answer(m.id, qi, ch);
      end if;

    elsif m.game = 'bataille' then
      if not (st -> 'locked' ->> bi)::boolean and since >= 2.5 then
        hand := sec -> 'hands' -> b::text; stat := st ->> 'stat';
        idx := floor(random() * jsonb_array_length(hand))::int;
        if random() < skill then
          best := -1;
          for k in 0..jsonb_array_length(hand) - 1 loop
            select coalesce(case stat when 'cps' then cps when 'clk' then clk else val end, 0) into v from public.card_catalog where id = hand ->> k;
            if v > best then best := v; idx := k; end if;
          end loop;
        end if;
        perform public.bat_play(m.id, idx);
      end if;

    elsif m.game = 'course' then
      if not (st -> 'done' ->> bi)::boolean then
        startt := (st ->> 'start_at')::timestamptz; dist := (st ->> 'distance')::numeric;
        if sec ? 'bot_taps' then
          bt := nullif(sec ->> 'bot_t', '')::numeric;
          select array_agg(x::numeric order by o) into taps from jsonb_array_elements_text(sec -> 'bot_taps') with ordinality as q(x, o);
        else
          -- cadence de sprint selon le palier (coups par seconde) : en dessous de 1/s on perd vraiment du temps (~55 s au palier 0, ~42 s au palier 9)
          c := (array[0.30, 0.40, 0.55, 0.80, 1.2, 2, 3.5, 5, 6.5, 8])[coalesce(tier, 0) + 1];
          taps := array(select round((0.3 + (9 - coalesce(tier, 0)) * 0.25 + (abs(hashtext(m.id::text)) % 50) / 100.0 + g / c + ((abs(hashtext(m.id::text || g::text)) % 100) / 100.0 - 0.5) * 0.03)::numeric, 3) from generate_series(1, 600) g);
          bt := public._race_replay(taps, dist);
          if bt is not null then taps := array(select x from unnest(taps) x where x <= bt + 0.4); end if;
          sec := sec || jsonb_build_object('bot_t', bt, 'bot_taps', to_jsonb(taps));
          update public.match_secrets set data = sec where match_id = m.id;
        end if;
        el := extract(epoch from (clock_timestamp() - startt));
        if bt is null then
          if el >= 70 then perform public.race_submit(m.id, '[]'::jsonb); end if;
        elsif el >= bt + 0.15 then
          perform public.race_submit(m.id, to_jsonb(taps));
        elsif el > 0 then
          perform public.race_progress(m.id, least(dist * 0.99, dist * el / bt));
        end if;
      end if;
    end if;
  exception when others then null;       -- un bot ne doit jamais empêcher le joueur de lire sa partie
  end;
  perform set_config('request.jwt.claim.sub', orig, true);
  perform set_config('app.in_bot', '0', true);
end;
$$;
revoke all on function public._bot_step(uuid) from public, anon, authenticated;

-- Recherche : au bout de 9 s sans adversaire, un bot du niveau du joueur prend la place
create or replace function public.mm_bot(p_game text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); q public.matchmaking_queue%rowtype; mid uuid; lpv int; idx int; tier int; bot uuid;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('mm_bot', 40, 600);
  if p_game not in ('pbc', 'des421', 'quiz', 'bataille', 'course') then raise exception 'Jeu inconnu'; end if;
  select id into mid from public.matches where status = 'active' and game = p_game and uid in (p1, p2) order by created_at desc limit 1;
  if found then delete from public.matchmaking_queue where user_id = uid; return jsonb_build_object('match_id', mid); end if;
  select * into q from public.matchmaking_queue where user_id = uid and game = p_game for update;
  if not found or q.since > now() - interval '9 seconds' then return jsonb_build_object('waiting', true); end if;
  select coalesce(max(lp), 0) into lpv from public.league_ratings where user_id = uid and game = p_game and season = public.current_season();
  idx := least(25, lpv / 100);
  tier := case when idx < 24 then idx / 3 else idx - 16 end;
  select id into bot from public.profiles where is_bot and bot_tier = tier;
  if bot is null then return jsonb_build_object('waiting', true); end if;
  delete from public.matchmaking_queue where user_id = uid;
  mid := public._create_match(p_game, bot, uid);
  update public.matches set vs_bot = true where id = mid;
  return jsonb_build_object('match_id', mid, 'bot', true);
end;
$$;
revoke all on function public.mm_bot(text) from public, anon, authenticated;
grant execute on function public.mm_bot(text) to authenticated;

-- Équipes d'Ultimate Comptoir des bots (une par palier) : choisies dans le vrai catalogue selon le niveau
create or replace function public._seed_bot_ut() returns void language plpgsql security definer set search_path = public as $$
declare slots text[] := array['GB', 'DEF', 'DEF', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT', 'ATT']; bt record; players jsonb; ids text[]; i int; c public.card_catalog%rowtype; target numeric; ev jsonb;
begin
  for bt in select id, bot_tier from public.profiles where is_bot loop
    players := '[]'::jsonb; ids := '{}'; target := 58 + bt.bot_tier * 4.4;
    for i in 1..11 loop
      select * into c from public.card_catalog where cat = 'foot' and pos = slots[i] and ovr is not null and not (id = any(ids)) order by abs(ovr - (target + (random() * 4 - 2))) limit 1;
      ids := ids || c.id;
      players := players || jsonb_build_array(jsonb_build_object('name', c.name, 'pos', c.pos, 'ovr', coalesce(c.ovr, 50), 'nat', coalesce(c.nat, ''), 'clubs', to_jsonb(c.clubs), 'q', false));
    end loop;
    ev := public._ut_eval(players);
    insert into public.ut_teams as t (user_id, players, ev, power, updated_at) values (bt.id, players, ev, (ev ->> 'power')::int, now() + interval '10 years')
      on conflict (user_id) do update set players = excluded.players, ev = excluded.ev, power = excluded.power, updated_at = excluded.updated_at;
  end loop;
end;
$$;
revoke all on function public._seed_bot_ut() from public, anon, authenticated;
select public._seed_bot_ut();

revoke all on function public._finish_match(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public._deal_hand(uuid) from public, anon, authenticated;
revoke all on function public.match_get(uuid) from public, anon;
grant execute on function public.match_get(uuid) to authenticated;
revoke all on function public.mm_join(text) from public, anon;
grant execute on function public.mm_join(text) to authenticated;
revoke all on function public.ut_play(text[]) from public, anon;
grant execute on function public.ut_play(text[]) to authenticated;
