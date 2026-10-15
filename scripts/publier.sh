#!/usr/bin/env bash
# Met en ligne : fusionne la branche « dev » dans « main » (main = le site en ligne, Hostinger tire main).
# Usage : scripts/publier.sh   (depuis la branche dev, tout commité)
set -euo pipefail
cd "$(dirname "$0")/.."
[ "$(git branch --show-current)" = "dev" ] || { echo "Va d'abord sur la branche dev : git checkout dev"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Il reste des changements non commités. Commite d'abord."; exit 1; }
for f in js/*.js js/games/*.js; do node -e "new Function(require('fs').readFileSync('$f','utf8'))" || { echo "Erreur de syntaxe dans $f"; exit 1; }; done
node scripts/audit_cards.js | grep -E "Images manquantes *: 0" >/dev/null || { echo "Il manque des images de cartes (node scripts/audit_cards.js)"; exit 1; }
git push origin dev
N=$(gh pr list --head dev --base main --json number -q '.[0].number')
if [ -z "$N" ]; then
  gh pr create --base main --head dev --title "${1:-Mise en ligne}" --body "Fusion de dev dans main (version en ligne)."
  N=$(gh pr list --head dev --base main --json number -q '.[0].number')
fi
gh pr merge "$N" --merge
git fetch origin && git merge origin/main -m "chore: synchroniser dev avec main" >/dev/null 2>&1 || true
echo "En ligne : main est à jour. Tu restes sur dev pour la suite."
