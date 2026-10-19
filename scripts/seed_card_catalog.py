#!/usr/bin/env python3
"""
Envoie le catalogue des cartes dans Supabase (table card_catalog) pour le quiz et l'Ultimate Comptoir côté serveur.
Usage : python3 scripts/seed_card_catalog.py   (à relancer quand on change js/balance.js : les stats de la Bataille viennent d'ici)
"""
import json, os, subprocess
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = """
const fs=require('fs'),vm=require('vm');const ctx={console:{log(){}}};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/cigarettes_db.js','js/empire_db_expansion.js','js/cards_extra.js','js/cards_season.js','js/empire_db.js','js/balance.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const P={cigarette:'cig',alcool:'alc',briquet:'acc',beauf:'ter',actrice:'act',foot:'fbl',refs:'ref',chanteur:'mus',culte:'cul'};
console.log(JSON.stringify(ctx.getAllBaseItemsList().map(c=>({id:c.id,name:c.name,cat:c.cat,rarity:c.rarity,
  img:(c.img&&c.img.startsWith('assets/cards/'))?c.img:(c.image&&c.image.startsWith('assets/cards/'))?c.image:`assets/cards/${P[c.cat]||'drg'}_${c.id}.webp`,
  pos:c.pos||null,nat:c.nat||null,clubs:c.clubs||[],ovr:c.ovr||null,cps:c.cashPerSec,clk:c.clickBoost,val:c.value}))));
"""
cards = json.loads(subprocess.check_output(["node", "-e", JS], cwd=BASE))
# Cartes dont l'image est une illustration dessinée (le nom y est écrit) : exclues du quiz
todo = {e["id"]: e for e in json.load(open(os.path.join(BASE, "scripts/data/images_todo.json")))}
credits = json.load(open(os.path.join(BASE, "data/image_credits.json")))
def quiz_ok(c):
    if c["cat"] in ("culte", "refs", "saison"):
        return False
    e = todo.get(c["id"])
    if e and ("gen" in e or ("query" in e and c["id"] not in credits)):
        return False
    return True
def q(s): return "'" + str(s).replace("'", "''") + "'"
def arr(a): return "array[" + ",".join(q(x) for x in a) + "]::text[]" if a else "'{}'::text[]"
rows = []
for c in cards:
    rows.append("(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)" % (q(c["id"]), q(c["name"]), q(c["cat"]), q(c["rarity"]), q(c["img"]),
        "true" if quiz_ok(c) else "false", q(c["pos"]) if c["pos"] else "null", q(c["nat"]) if c["nat"] else "null", arr(c["clubs"]), c["ovr"] if c["ovr"] else "null", c["cps"], c["clk"], c["val"]))
print(len(rows), "cartes,", sum(1 for c in cards if quiz_ok(c)), "utilisables au quiz")
for i in range(0, len(rows), 400):
    sql = ("insert into public.card_catalog (id,name,cat,rarity,img,quiz_ok,pos,nat,clubs,ovr,cps,clk,val) values " + ",".join(rows[i:i+400]) +
           " on conflict (id) do update set name=excluded.name, cat=excluded.cat, rarity=excluded.rarity, img=excluded.img, quiz_ok=excluded.quiz_ok, pos=excluded.pos, nat=excluded.nat, clubs=excluded.clubs, ovr=excluded.ovr, cps=excluded.cps, clk=excluded.clk, val=excluded.val;")
    out = subprocess.check_output([os.path.join(BASE, "scripts/supabase.sh"), sql]).decode()
    if out.strip() not in ("[]", ""):
        print("réponse:", out[:300])
print("catalogue envoyé")
