-- ============================================================
-- Migration 013 : plus de parties contre l'ordinateur. Les points de ligue ne viennent que des matchs entre vrais joueurs.
-- On retire donc l'accès à league_record (qui enregistrait une victoire « contre l'ordi » annoncée par le navigateur).
-- ============================================================
revoke execute on function public.league_record(text, text) from authenticated;
