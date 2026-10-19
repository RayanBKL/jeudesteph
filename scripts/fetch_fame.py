#!/usr/bin/env python3
"""
THE ASHTRAY KING — Mesure la « célébrité » des cartes (nombre de langues de Wikipédia qui ont une page sur le sujet, via Wikidata)
pour que la rareté suive la notoriété : plus c'est connu, plus c'est rare.
Écrit scripts/data/fame_cache.json ({id: {"links": n, "exact": bool}}). Relançable (les résultats déjà trouvés sont gardés).
Usage : node scripts/dump_cards.js <fichier>  puis  python3 scripts/fetch_fame.py <fichier_cartes.json>
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(BASE, "scripts", "data", "fame_cache.json")
QCACHE = os.path.join(BASE, "scripts", "data", "fame_queries.json")
UA = "AshtrayKingCardBuilder/1.0 (jeu satirique; contact@bklvision.fr)"
SKIP_CATS = {"refs", "culte", "saison"}


def get(url):
    for k in range(4):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read())
        except Exception:
            time.sleep(1.5 * (k + 1))
    return {}


def norm(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return re.sub(r"[^a-z0-9 ]", "", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()


def sitelinks(qids):
    out = {}
    for i in range(0, len(qids), 50):
        d = get("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(qids[i:i + 50]), "props": "sitelinks", "format": "json"}))
        for q, e in (d.get("entities") or {}).items():
            out[q] = sum(1 for k in (e.get("sitelinks") or {}) if k.endswith("wiki") and k not in ("commonswiki", "specieswiki", "metawiki", "mediawikiwiki", "wikidatawiki"))
    return out


def lookup(query):
    """Meilleure page pour une requête : (nombre de langues, correspondance exacte du nom ?) ou None"""
    q = norm(query)
    if len(q) < 3:
        return None
    d = get("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbsearchentities", "search": query, "language": "fr", "uselang": "fr", "type": "item", "limit": 5, "format": "json"}))
    res = d.get("search") or []
    pick = None
    for r in res:
        lab = norm(r.get("label", ""))
        if lab == q:
            pick = (r["id"], True); break
    if not pick:
        for r in res:
            lab = norm(r.get("label", ""))
            if lab and (lab.startswith(q) or q.startswith(lab)) and len(lab) >= 4:
                pick = (r["id"], False); break
    return pick


def main():
    cards = json.load(open(sys.argv[1]))
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    qc = json.load(open(QCACHE)) if os.path.exists(QCACHE) else {}
    todo = [c for c in cards if c["cat"] not in SKIP_CATS and not c.get("wd") and c["id"] not in cache]
    print(len(todo), "cartes à mesurer", flush=True)

    def queries(name):
        name = re.sub(r"\(.*?\)|['\"«»]", " ", name).strip()
        w = name.split()
        qs = [name]
        if len(w) > 2: qs.append(" ".join(w[:2]))
        if len(w) > 1: qs.append(w[0])
        return list(dict.fromkeys(q for q in qs if len(q) >= 4))

    allq = sorted({q for c in todo for q in queries(c["name"]) if q not in qc})
    print(len(allq), "requêtes", flush=True)
    def run(q):
        qc[q] = lookup(q)
    with ThreadPoolExecutor(6) as ex:
        for i, _ in enumerate(ex.map(run, allq)):
            if i % 200 == 0:
                print(" ", i, "/", len(allq), flush=True); json.dump(dict(list(qc.items())), open(QCACHE, "w"), ensure_ascii=False)
    json.dump(dict(list(qc.items())), open(QCACHE, "w"), ensure_ascii=False)
    qids = sorted({v[0] for v in qc.values() if v})
    links = {}
    cached_links = os.path.join(BASE, "scripts", "data", "fame_links.json")
    if os.path.exists(cached_links): links = json.load(open(cached_links))
    need = [q for q in qids if q not in links]
    for i in range(0, len(need), 50):
        links.update(sitelinks(need[i:i + 50]))
    json.dump(links, open(cached_links, "w"))
    for c in todo:
        best = None
        for k, q in enumerate(queries(c["name"])):
            r = qc.get(q)
            if not r: continue
            n = links.get(r[0], 0)
            exact = bool(r[1]) and k == 0
            if best is None or (exact, n) > (best["exact"], best["links"]):
                best = {"links": n, "exact": exact}
            if exact: break
        cache[c["id"]] = best or {"links": 0, "exact": False}
    json.dump(cache, open(CACHE, "w"), ensure_ascii=False)
    print("terminé :", len(cache), "cartes mesurées")


if __name__ == "__main__":
    main()
