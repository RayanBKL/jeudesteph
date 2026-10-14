#!/usr/bin/env python3
"""
THE ASHTRAY KING — Images pour les mèmes sans GIF (recherche d'images web).
Récupère jusqu'à 4 candidats par mème dans un dossier de travail (pas dans assets) pour qu'on choisisse ensuite.
Usage : python3 scripts/fetch_meme_images.py <dossier_de_travail>
"""
import html, io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if __name__ == "__main__" else ""
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "Accept-Language": "fr-FR,fr;q=0.9"}
Q = json.load(open(os.path.join(BASE, "scripts", "data", "meme_queries.json")))


def get(url, binary=False, timeout=25):
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()
    return data if binary else data.decode("utf-8", "ignore")


def bing_images(q):
    page = get("https://www.bing.com/images/search?" + urllib.parse.urlencode({"q": q, "form": "HDRSC2", "first": 1, "safeSearch": "Moderate"}))
    out = []
    for m in re.findall(r'm="(\{[^"]+\})"', page):
        try:
            j = json.loads(html.unescape(m))
        except Exception:
            continue
        if j.get("murl"):
            out.append({"url": j["murl"], "title": j.get("t", "")})
    return out


def main():
    raw = open(os.path.join(BASE, "js", "cards_extra.js"), encoding="utf-8").read()
    cards = json.loads(raw[raw.index("= [") + 2: raw.rindex("];") + 1])
    memes = [c for c in cards if c["cat"] == "refs"]
    cache_gif = json.load(open(os.path.join(BASE, "scripts", "data", "giphy_cache.json")))
    meta_path = os.path.join(OUT, "meta.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    for c in memes:
        cid = c["id"]
        if cid in meta or (cache_gif.get(cid, {}).get("found") and not cache_gif[cid].get("loose")):
            continue
        q = (Q.get(c["name"]) or c["name"]) + " meme"
        got = []
        try:
            cands = bing_images(q)
        except Exception as e:
            print("recherche échouée", c["name"], e, flush=True)
            time.sleep(5)
            continue
        for k, cand in enumerate(cands[:14]):
            if len(got) >= 4:
                break
            try:
                data = get(cand["url"], binary=True, timeout=15)
                im = Image.open(io.BytesIO(data)).convert("RGB")
                if min(im.size) < 200 or max(im.size) / min(im.size) > 2.6:
                    continue
                im.thumbnail((520, 520))
                p = os.path.join(OUT, f"{cid}_{len(got)+1}.jpg")
                im.save(p, "JPEG", quality=86)
                got.append({"file": os.path.basename(p), "title": cand["title"], "src": cand["url"]})
            except Exception:
                continue
        meta[cid] = {"name": c["name"], "q": q, "cands": got}
        json.dump(meta, open(meta_path, "w"), ensure_ascii=False, indent=0)
        print(c["name"], "->", len(got), flush=True)
        time.sleep(1.5)
    print("FINI", flush=True)


if __name__ == "__main__":
    main()
