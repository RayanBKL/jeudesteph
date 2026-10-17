-- Migration 014 : limite de clics doublée (80/s côté jeu) : le serveur accepte jusqu'à 100 clics/s de moyenne entre deux sauvegardes
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
        elapsed := greatest(extract(epoch from (ts - least(cur, coalesce(p_base, cur)))), 1);   -- depuis la version dont le joueur est parti (plusieurs appareils)
        dclk := nclk - oclk; dpk := npk - opk;
        if dclk > 100 * elapsed + 3000 then reason := coalesce(reason, 'vitesse de clics'); end if;
        if dpk > elapsed / 0.4 + 150 then reason := coalesce(reason, 'vitesse d''ouverture de paquets'); end if;
        if (copies - ocopies) > 8 * greatest(dpk, 0) + 500 then reason := coalesce(reason, 'cartes sans paquets'); end if;
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
