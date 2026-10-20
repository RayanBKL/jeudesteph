-- ============================================================
-- THE ASHTRAY KING — Migration 032 : maintenance côté serveur
-- Les pages déjà ouvertes avant la maintenance ne chargent pas le nouveau code : elles ne peuvent donc pas savoir qu'elles
-- doivent s'arrêter. Pendant la maintenance, cloud_save_stamp renvoie une date différente à chaque appel : toutes les pages
-- (anciennes comme nouvelles) rechargent, et le rechargement tombe sur l'écran « Le bar est fermé » (503).
-- Activé / désactivé par scripts/maintenance.sh (table site_flags, non lisible par le navigateur).
-- ============================================================
create table if not exists public.site_flags (key text primary key, value text not null default '');
alter table public.site_flags enable row level security;
revoke all on public.site_flags from anon, authenticated;
insert into public.site_flags (key, value) values ('maintenance', 'off') on conflict (key) do nothing;

create or replace function public.cloud_save_stamp() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare maint boolean;
begin
  select exists (select 1 from public.site_flags where key = 'maintenance' and value = 'on') into maint;
  return (select jsonb_build_object('updated_at', case when maint then clock_timestamp() else updated_at end, 'device', device)
            from public.cloud_saves where user_id = auth.uid());
end;
$$;
revoke all on function public.cloud_save_stamp() from public, anon, authenticated;
grant execute on function public.cloud_save_stamp() to authenticated;
