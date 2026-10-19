-- Titres et succès affichés sur le profil (cosmétique : le jeu envoie le titre choisi et jusqu'à 6 succès)
alter table public.profiles add column if not exists title text;
alter table public.profiles add column if not exists badges text[] not null default '{}';

create or replace function public.profile_set_title(p_title text, p_badges text[]) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text := nullif(btrim(coalesce(p_title, '')), ''); b text[] := '{}'; x text;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  perform public._rl('profile_title', 30, 600);
  if t is not null and (char_length(t) > 32 or t !~ '^[[:alnum:] ''.-éèêëàâäîïôöùûüçÉÈÀÇ]+$') then raise exception 'Titre invalide'; end if;
  foreach x in array coalesce(p_badges, '{}') loop
    if x ~ '^[a-z0-9_]{2,24}$' and cardinality(b) < 6 then b := b || x; end if;
  end loop;
  update public.profiles set title = t, badges = b where id = uid;
end;
$$;
revoke all on function public.profile_set_title(text, text[]) from public, anon, authenticated;
grant execute on function public.profile_set_title(text, text[]) to authenticated;

CREATE OR REPLACE FUNCTION public.player_profile(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); r jsonb; rel text := 'aucune'; f public.friendships%rowtype;
begin
  if uid is null then raise exception 'Non connecté'; end if;
  if p_id = uid then rel := 'self';
  else
    select * into f from public.friendships where least(requester, target) = least(uid, p_id) and greatest(requester, target) = greatest(uid, p_id);
    if found then rel := case when f.status = 'accepted' then 'ami' when f.requester = uid then 'envoyee' else 'recue' end; end if;
  end if;
  select jsonb_build_object(
    'id', p.id, 'pseudo', p.pseudo, 'avatar', coalesce(p.avatar, p.avatar_small), 'friend_code', p.friend_code,
    'level', coalesce((p.summary ->> 'level')::int, 1), 'cards', coalesce((p.summary ->> 'cards')::int, 0),
    'online', p.last_seen > now() - interval '90 seconds', 'since', p.created_at, 'bio', p.bio, 'title', p.title, 'badges', to_jsonb(p.badges), 'showcase', to_jsonb(p.showcase),
    'rel', rel,
    'clan', (select jsonb_build_object('name', c.name, 'tag', c.tag) from public.clan_members m join public.clans c on c.id = m.clan_id where m.user_id = p.id),
    'ratings', coalesce((select jsonb_agg(jsonb_build_object('game', game, 'lp', lp, 'wins', wins, 'losses', losses) order by game) from public.league_ratings where user_id = p.id and season = public.current_season()), '[]'::jsonb)
  ) into r from public.profiles p where p.id = p_id;
  if r is null then raise exception 'Joueur introuvable'; end if;
  return r;
end;
$function$
;
revoke all on function public.player_profile(uuid) from public, anon;
grant execute on function public.player_profile(uuid) to authenticated;
