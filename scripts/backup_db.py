#!/usr/bin/env python3
"""
Sauvegarde locale de la base (comptes, sauvegardes de jeu, rangs, clans, amis) dans backups/AAAA-MM-JJ_HHMM/.
Usage : python3 scripts/backup_db.py   (à lancer une fois par jour, ou avant chaque grosse modification)
Les fichiers contiennent des données de joueurs : le dossier backups/ est ignoré par git. Ne le publie jamais.
"""
import json, os, time, urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(BASE, ".env"), encoding="utf-8"):
    if "=" in line and not line.startswith("#"):
        k, v = line.strip().split("=", 1)
        env[k] = v
URL = f"https://api.supabase.com/v1/projects/{env['SUPABASE_PROJECT_REF']}/database/query"
TABLES = {
    "profiles": "select id, pseudo, friend_code, summary, flagged, created_at, last_seen from public.profiles",
    "cloud_saves": "select user_id, data, device, updated_at from public.cloud_saves",
    "league_ratings": "select * from public.league_ratings",
    "league_log": "select * from public.league_log",
    "clans": "select * from public.clans",
    "clan_members": "select * from public.clan_members",
    "friendships": "select * from public.friendships",
    "cheat_flags": "select * from public.cheat_flags",
}
out = os.path.join(BASE, "backups", time.strftime("%Y-%m-%d_%H%M"))
os.makedirs(out, exist_ok=True)
os.chmod(os.path.join(BASE, "backups"), 0o700)
for name, sql in TABLES.items():
    req = urllib.request.Request(URL, data=json.dumps({"query": sql}).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + env["SUPABASE_ACCESS_TOKEN"], "Content-Type": "application/json"})
    rows = json.load(urllib.request.urlopen(req, timeout=120))
    with open(os.path.join(out, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    print(f"{name}: {len(rows)} lignes")
print("Sauvegarde dans", out)
