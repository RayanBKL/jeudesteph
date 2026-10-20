-- ============================================================
-- THE ASHTRAY KING — Migration 030 : l'admin peut fixer le niveau d'un joueur
-- Comme pour l'argent, le changement est un « cadeau » en attente (kind = 'level', mode 'set', amount = niveau) :
-- le jeu du joueur l'applique à sa prochaine synchronisation (Account.applyGrants) et envoie sa partie.
-- ============================================================
create or replace function public.admin_set_level(p_id uuid, p_level int, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare ps text;
begin
  if not public._is_admin() then raise exception 'Accès refusé'; end if;
  if p_level is null or p_level < 1 or p_level > 300 then raise exception 'Niveau invalide (1 à 300)'; end if;
  select pseudo into ps from public.profiles where id = p_id;
  if ps is null then raise exception 'Joueur introuvable'; end if;
  insert into public.account_grants (user_id, mode, amount, note, kind) values (p_id, 'set', p_level, left(coalesce(p_note, ''), 120), 'level');
  insert into public.admin_log (admin_id, action, target_id, target_pseudo, detail) values (auth.uid(), 'niveau', p_id, ps, jsonb_build_object('niveau', p_level, 'note', p_note));
end;
$$;
revoke all on function public.admin_set_level(uuid, int, text) from public, anon;
grant execute on function public.admin_set_level(uuid, int, text) to authenticated;
