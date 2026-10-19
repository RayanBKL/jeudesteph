#!/usr/bin/env python3
"""
THE ASHTRAY KING — Remet la rareté en accord avec la notoriété : plus une carte est connue, plus elle est rare.
Pour chaque famille on garde EXACTEMENT le même nombre de cartes par rareté (l'économie ne change pas) mais on les redistribue
selon la célébrité (nombre de langues de Wikipédia, voir fetch_fame.py). Les cartes sans mesure fiable ne bougent pas.
Écrit js/rarity_fix.js (chargé après la base des cartes) avec les nouvelles stats des cartes dont la rareté change.
Usage : node scripts/dump_cards.js <cartes.json> ; python3 scripts/rebalance_rarity.py <cartes.json> [--write]
"""
import glob, hashlib, json, os, sys, collections

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "scripts", "data")
RAR = ["commune", "peu-commune", "rare", "epique", "legendaire", "mythique"]
RANK = {r: i for i, r in enumerate(RAR)}
RCFG = {"commune": (0.05, 0.1, 25), "peu-commune": (0.2, 0.3, 100), "rare": (0.8, 0.8, 500), "epique": (3.0, 2.0, 2500), "legendaire": (12.0, 6.0, 15000), "mythique": (50.0, 20.0, 100000)}
CATS = ["cigarette", "briquet", "alcool", "drogue", "actrice", "beauf", "foot", "chanteur"]


def jitter(seed, v):
    h = int(hashlib.md5(("j" + seed).encode()).hexdigest(), 16)
    k = 0.85 + (h % 3000) / 10000
    return round(v * k, 2) if v < 100 else int(round(v * k))


def stats(rarity, seed):
    cps, click, val = RCFG[rarity]
    return [jitter(seed, cps), jitter(seed + "c", click), jitter(seed + "v", val)]


# Marques et noms que tout le monde connaît (liste écrite à la main, voir la note en haut) : leurs cartes sont au moins « rare »
KNOWN = {
    "cigarette": ["marlboro", "gauloises", "gitanes", "camel", "lucky strike", "winston", "chesterfield", "pall mall", "dunhill", "benson", "parliament", "rothmans", "kent ", "l&m", "philip morris",
                  "davidoff", "lambert", "peter stuyvesant", "news ", "royale", "mild seven", "kool", "newport", "salem", "cohiba", "montecristo", "romeo y julieta", "partagas", "fortuna", "ducados"],
    "alcool": ["kronenbourg", "1664", "ricard", "pastis 51", "martini", "grey goose", "captain morgan", "jim beam", "jägermeister", "jagermeister", "smirnoff", "baileys", "cointreau", "grand marnier", "suze",
               "pernod", "get 27", "get27", "desperados", "stella artois", "pelforth", "fischer", "33 export", "carlsberg", "tuborg", "beck", "jupiler", "corona", "guinness", "heineken", "budweiser", "leffe",
               "bacardi", "absolut", "jack daniel", "johnnie walker", "jameson", "havana club", "moët", "moet", "dom pérignon", "hennessy", "chivas", "coca-cola", "coca cola", "orangina", "fanta", "sprite", "pepsi",
               "schweppes", "red bull", "perrier", "evian", "monster energy", "cuba libre", "mojito", "piña colada", "margarita", "sex on the beach", "vodka", "whisky", "champagne", "chartreuse", "tequila", "rhum"],
    "drogue": ["cannabis", "weed", "marijuana", "haschich", "hashish", "cocaïne", "héroïne", "lsd", "mdma", "ecstasy", "kétamine", "ketamine", "crack", "opium", "morphine", "amphétamine", "speed",
               "xanax", "valium", "prozac", "codéine", "lean", "champignons", "psilocybine", "méthadone", "oxycodone", "fentanyl", "méthamphétamine", "crystal meth", "ritaline"],
}
KNOWN_FAME = {"actrice": 30}   # actrices : on se fie au nombre de langues Wikipédia (≥ 30) quand la correspondance est exacte


def main():
    cards = json.load(open(sys.argv[1]))
    cache = json.load(open(os.path.join(DATA, "fame_cache.json")))
    by = {c["id"]: c for c in cards}
    new = {}

    def is_known(c):
        nm = " " + c["name"].lower()
        if c["cat"] in KNOWN:
            return any((" " + k.strip()) in nm or nm.strip().startswith(k.strip()) for k in KNOWN[c["cat"]])
        if c["cat"] in KNOWN_FAME:
            f = cache.get(c["id"])
            return bool(f and f["exact"] and f["links"] >= KNOWN_FAME[c["cat"]])
        return False

    def fame_of(c):
        f = cache.get(c["id"]); return (f["links"] if f else 0)

    for cat in list(KNOWN) + list(KNOWN_FAME):
        group = [c for c in cards if c["cat"] == cat]
        known = [c for c in group if is_known(c)]
        promote = [c for c in known if RANK[c["rarity"]] < RANK["rare"]]
        # partenaires : cartes peu connues déjà « rare », triées de la moins connue à la plus connue
        partners = sorted([c for c in group if c["rarity"] == "rare" and not is_known(c)], key=fame_of)
        # on promeut d'abord les plus connues
        promote.sort(key=lambda c: -fame_of(c))
        done = 0
        for p in promote:
            if not partners: break
            d = partners.pop(0)
            new[p["id"]] = "rare"; new[d["id"]] = p["rarity"]; done += 1
        print(f"{cat:10} {len(group):5} cartes · connues {len(known):4} · à remonter {len(promote):3} · remontées {done:3}")

    changes = {i: [r] + stats(r, i) for i, r in new.items()}
    # contrôle : même nombre de cartes par rareté et par famille
    for cat in {c["cat"] for c in cards}:
        b = collections.Counter(c["rarity"] for c in cards if c["cat"] == cat)
        a = collections.Counter(new.get(c["id"], c["rarity"]) for c in cards if c["cat"] == cat)
        assert a == b, (cat, a, b)
    print("\nExemples remontés :", [by[i]["name"] + f" ({by[i]['rarity']}→rare)" for i in list(new) if new[i] == "rare"][:25])
    print("Exemples rétrogradés :", [by[i]["name"] + f" (rare→{new[i]})" for i in list(new) if new[i] != "rare"][:25])
    if "--write" in sys.argv:
        js = ("// Rareté recalculée selon la notoriété (scripts/rebalance_rarity.py) : les marques et noms connus de tout le monde sont au moins « rare »,\n"
              "// échangés avec des cartes peu connues pour garder EXACTEMENT le même nombre de cartes par rareté et par famille (l'économie ne change pas).\n"
              "// Format : id → [rareté, revenu/s, bonus clic, valeur] (avant mise à l'échelle de balance.js).\n"
              "(function () {\n  const FIX = " + json.dumps(changes, ensure_ascii=False, separators=(",", ":")) + ";\n"
              "  if (typeof ALL_BASE_ITEMS_MAP === 'undefined') return;\n"
              "  Object.keys(FIX).forEach(id => { const it = ALL_BASE_ITEMS_MAP.get(id); if (!it) return; const v = FIX[id]; it.rarity = v[0]; it.cashPerSec = v[1]; it.clickBoost = v[2]; it.value = v[3]; });\n"
              "})();\n")
        open(os.path.join(BASE, "js", "rarity_fix.js"), "w", encoding="utf-8").write(js)
        print("\njs/rarity_fix.js écrit :", len(changes), "cartes")


if __name__ == "__main__":
    main()
