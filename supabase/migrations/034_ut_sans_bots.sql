-- ============================================================
-- THE ASHTRAY KING — Migration 034 : Ultimate Comptoir sans bots
-- L'adversaire est TOUJOURS l'équipe enregistrée d'un vrai joueur (décision du porteur du projet). S'il n'y en a aucune, le jeu le dit.
-- ============================================================
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

  select * into opp from (select ut.* from public.ut_teams ut join public.profiles pr on pr.id = ut.user_id where ut.user_id <> uid and not coalesce(pr.is_bot, false) and ut.updated_at > now() - interval '60 days' order by abs(ut.power - (my ->> 'power')::int) limit 8) n order by random() limit 1;
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
$function$;
revoke all on function public.ut_play(text[]) from public, anon;
grant execute on function public.ut_play(text[]) to authenticated;
delete from public.ut_teams where user_id in (select id from public.profiles where is_bot);
