-- ============================================================
-- THE ASHTRAY KING — Migration 033 : un seul appareil actif à la fois
-- Le dernier appareil / onglet ouvert devient l'appareil principal (session_claim). Les autres voient « Tu es déjà connecté sur un autre
-- appareil » avec un bouton « Jouer sur cet appareil » qui reprend la main. L'information circule par cloud_save_stamp (déjà interrogé
-- toutes les 6 s par le jeu) : champs sid (session active) et sid_device (nom de l'appareil).
-- ============================================================
create table if not exists public.active_sessions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sid text not null,
  device text,
  claimed_at timestamptz not null default now()
);
alter table public.active_sessions enable row level security;
revoke all on public.active_sessions from anon, authenticated;

create or replace function public.session_claim(p_sid text, p_device text default null) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('session_claim', 30, 60);
  if p_sid is null or p_sid !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'Session invalide'; end if;
  insert into public.active_sessions (user_id, sid, device, claimed_at) values (uid, p_sid, left(coalesce(p_device, ''), 30), now())
  on conflict (user_id) do update set sid = excluded.sid, device = excluded.device, claimed_at = excluded.claimed_at;
end;
$$;
revoke all on function public.session_claim(text, text) from public, anon, authenticated;
grant execute on function public.session_claim(text, text) to authenticated;

create or replace function public.cloud_save_stamp() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare maint boolean;
begin
  select exists (select 1 from public.site_flags where key = 'maintenance' and value = 'on') into maint;
  return (select jsonb_build_object('updated_at', case when maint then clock_timestamp() else c.updated_at end, 'device', c.device,
                                    'sid', a.sid, 'sid_device', a.device)
            from public.cloud_saves c left join public.active_sessions a on a.user_id = c.user_id where c.user_id = auth.uid());
end;
$$;
revoke all on function public.cloud_save_stamp() from public, anon, authenticated;
grant execute on function public.cloud_save_stamp() to authenticated;
