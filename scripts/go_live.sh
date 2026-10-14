#!/usr/bin/env bash
# Passage en ligne : configure Supabase pour ton vrai domaine et rend l'inscription par e-mail obligatoire.
# Usage : scripts/go_live.sh https://ton-domaine.fr [smtp_host smtp_port smtp_user smtp_pass expediteur@ton-domaine.fr]
# Sans SMTP, Supabase n'envoie que 2 e-mails par heure : configure Resend/Brevo/etc. AVANT d'exiger la confirmation.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
SITE="${1:?domaine requis, ex. https://ashtray-king.fr}"
API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth"
BODY=$(python3 - "$@" <<'PY'
import json, sys
a = sys.argv[1:]
site = a[0].rstrip('/')
d = {"site_url": site, "uri_allow_list": site + "," + site + "/*"}
if len(a) >= 6:
    d.update({"smtp_host": a[1], "smtp_port": a[2], "smtp_user": a[3], "smtp_pass": a[4], "smtp_admin_email": a[5], "smtp_sender_name": "The Ashtray King",
              "mailer_autoconfirm": False, "rate_limit_email_sent": 30})
else:
    print("ATTENTION : pas de SMTP fourni, la confirmation par e-mail reste désactivée.", file=sys.stderr)
print(json.dumps(d))
PY
)
curl -fsS -X PATCH -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" "$API" -d "$BODY" >/dev/null && echo "Supabase configuré pour $SITE"
