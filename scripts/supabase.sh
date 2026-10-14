#!/bin/bash
# Outil local : exécute du SQL ou une migration sur le projet Supabase (jeton dans .env, jamais commité)
# Usage : scripts/supabase.sh "select 1"      |      scripts/supabase.sh -f supabase/migrations/002_xxx.sql
cd "$(dirname "$0")/.." || exit 1
set -a; . ./.env; set +a
if [ "$1" = "-f" ]; then SQL="$(cat "$2")"; else SQL="$1"; fi
curl -s -m 120 -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$SQL")"
echo
