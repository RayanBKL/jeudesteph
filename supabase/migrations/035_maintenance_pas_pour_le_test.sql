-- ============================================================
-- THE ASHTRAY KING — Migration 035 : la maintenance ne touche pas la version de test
-- Pendant la maintenance, cloud_save_stamp renvoie une date différente à chaque appel (pour que les pages déjà ouvertes rechargent).
-- La version de test (jeu servi depuis un sous-dossier caché) passe p_test = true et garde la vraie date : elle ne recharge pas en boucle.
-- ============================================================
drop function if exists public.cloud_save_stamp();
create or replace function public.cloud_save_stamp(p_test boolean default false) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare maint boolean;
begin
  select exists (select 1 from public.site_flags where key = 'maintenance' and value = 'on') and not coalesce(p_test, false) into maint;
  return (select jsonb_build_object('updated_at', case when maint then clock_timestamp() else c.updated_at end, 'device', c.device,
                                    'sid', a.sid, 'sid_device', a.device)
            from public.cloud_saves c left join public.active_sessions a on a.user_id = c.user_id where c.user_id = auth.uid());
end;
$$;
revoke all on function public.cloud_save_stamp(boolean) from public, anon, authenticated;
grant execute on function public.cloud_save_stamp(boolean) to authenticated;
