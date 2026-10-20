#!/usr/bin/env bash
# Ferme / rouvre le site en ligne (main) SANS publier le travail en cours de « dev ».
# Usage : scripts/maintenance.sh on   → les joueurs voient « Le bar est fermé » (le tableau de bord admin et la version de test restent ouverts)
#         scripts/maintenance.sh off  → le site rouvre
# Principe : une petite branche part de main, ajoute (ou retire) le fichier « maintenance.on » à la racine, est fusionnée dans main
# (Hostinger redéploie), puis main est refusionnée dans dev. Rien d'autre n'est publié.
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-}"
[ "$MODE" = "on" ] || [ "$MODE" = "off" ] || { echo "Usage : scripts/maintenance.sh on|off"; exit 1; }
[ "$(git branch --show-current)" = "dev" ] || { echo "Va d'abord sur la branche dev."; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Il reste des changements non commités sur dev. Commite d'abord."; exit 1; }
git fetch -q origin
BR="maintenance-$MODE-$(date +%s)"
git checkout -q -b "$BR" origin/main
if [ "$MODE" = "on" ]; then
  printf 'maintenance\n' > maintenance.on
  git add maintenance.on
  MSG="chore: site en maintenance"
else
  git rm -q maintenance.on 2>/dev/null || { echo "Le site n'était pas en maintenance."; git checkout -q dev; git branch -q -D "$BR"; exit 0; }
  MSG="chore: fin de la maintenance"
fi
git commit -q -m "$MSG" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -q origin "$BR"
gh pr create --base main --head "$BR" --title "$MSG" --body "Bascule de maintenance (un seul fichier)." >/dev/null
N=$(gh pr list --head "$BR" --base main --json number -q '.[0].number')
gh pr merge "$N" --merge --delete-branch >/dev/null
git checkout -q dev
git branch -q -D "$BR" 2>/dev/null || true
git fetch -q origin && git merge origin/main -m "chore: synchroniser dev avec main" >/dev/null 2>&1 || true
# Côté serveur : les pages déjà ouvertes rechargent et tombent sur l'écran de maintenance (migration 032).
# On ne l'active qu'une fois le site fermé en ligne (sinon le rechargement retomberait sur le jeu).
if [ "$MODE" = "on" ]; then
  for _ in $(seq 1 60); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' https://theastrayking.bklvision.fr/)" = "503" ] && break
    sleep 5
  done
fi
scripts/supabase.sh "update public.site_flags set value='$MODE' where key='maintenance'" >/dev/null
echo "Maintenance : $MODE (en ligne et côté serveur)."
