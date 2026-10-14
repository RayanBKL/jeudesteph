#!/usr/bin/env python3
"""3e passe mèmes : candidats Giphy (2 requêtes max) + Bing (sans le mot « meme ») dans un dossier de travail. Usage : python3 scripts/fetch_meme_pass3.py <dossier> <redo.json>"""
import json, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_meme_gifs as g
import fetch_meme_gifs2 as g2
import fetch_meme_images as fi

OUT, REDO = sys.argv[1], sys.argv[2]
Q = json.load(open(os.path.join(g.BASE, "scripts", "data", "meme_queries3.json")))
raw = open(os.path.join(g.BASE, "js", "cards_extra.js"), encoding="utf-8").read()
names = {c["id"]: c["name"] for c in json.loads(raw[raw.index("= [") + 2: raw.rindex("];") + 1])}
meta_p = os.path.join(OUT, "meta.json")
meta = json.load(open(meta_p)) if os.path.exists(meta_p) else {}
key = g.load_env()["GIPHY_API_KEY"]
for cid in json.load(open(REDO)):
    if cid in meta:
        continue
    name = names[cid]
    gq, bq = Q.get(name, [name, name])
    entry = {"name": name, "gif": None, "imgs": []}
    # Giphy : on garde le 1er résultat dont le titre ressemble, sinon le 1er
    url = "https://api.giphy.com/v1/gifs/search?" + urllib.parse.urlencode({"api_key": key, "q": gq, "limit": 8, "rating": "pg-13"})
    res = g.http_json(url).get("data", [])
    time.sleep(37)
    want = g.tokens(gq) | g.tokens(name)
    best = next((x for x in res if want & g.tokens(x.get("title", "") + " " + x.get("slug", ""))), None)
    loose = False
    if not best and res:
        best, loose = res[0], True
    if best:
        img = best["images"]
        src = img["original"] if int(img["original"].get("size", 10**9)) < 3_500_000 else img["downsized"]
        try:
            data = urllib.request.urlopen(urllib.request.Request(src["url"], headers={"User-Agent": "Mozilla/5.0"}), timeout=40).read()
            p = os.path.join(OUT, cid + "_gif.webp")
            if g2.small_webp(data, p):
                entry["gif"] = {"file": os.path.basename(p), "title": best.get("title"), "loose": loose}
        except Exception as e:
            print("gif échec", name, e, flush=True)
    # Bing
    try:
        import io
        from PIL import Image
        for k, cand in enumerate(fi.bing_images(bq)[:10]):
            if len(entry["imgs"]) >= 3:
                break
            try:
                data = fi.get(cand["url"], binary=True, timeout=15)
                im = Image.open(io.BytesIO(data)).convert("RGB")
                if min(im.size) < 200 or max(im.size) / min(im.size) > 2.6:
                    continue
                im.thumbnail((520, 520))
                p = os.path.join(OUT, f"{cid}_img{len(entry['imgs'])+1}.jpg")
                im.save(p, "JPEG", quality=86)
                entry["imgs"].append({"file": os.path.basename(p), "title": cand["title"]})
            except Exception:
                continue
    except Exception as e:
        print("bing échec", name, e, flush=True)
    meta[cid] = entry
    json.dump(meta, open(meta_p, "w"), ensure_ascii=False, indent=0)
    print(name, "| gif" if entry["gif"] else "| -", len(entry["imgs"]), flush=True)
print("FINI", flush=True)
