#!/usr/bin/env python3
"""
THE ASHTRAY KING — 2e passe GIF pour les mèmes qui n'ont encore ni photo ni GIF.
Plus souple que la 1re passe : on prend le meilleur résultat Giphy (titre qui ressemble, sinon le 1er),
et on note « loose » quand le titre ne correspondait pas, pour contrôle visuel ensuite.
Relançable (cache). Clé : GIPHY_API_KEY dans .env. ~100 requêtes/heure.
"""
import json, os, re, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_meme_gifs as g

BASE = g.BASE
EXTRA_Q = json.load(open(os.path.join(BASE, "scripts", "data", "meme_queries.json"))) if os.path.exists(os.path.join(BASE, "scripts", "data", "meme_queries.json")) else {}


def small_webp(data, path):
    from PIL import Image, ImageSequence
    import io
    im = Image.open(io.BytesIO(data))
    n = getattr(im, "n_frames", 1)
    step = max(1, n // 24)
    frames, durs = [], []
    for i, fr in enumerate(ImageSequence.Iterator(im)):
        if i % step:
            continue
        f = fr.convert("RGBA")
        w = 260
        frames.append(f.resize((w, max(2, int(f.height * w / f.width))), Image.Resampling.LANCZOS))
        durs.append(max(40, int(fr.info.get("duration", 60)) * step))
    if len(frames) < 2:
        frames[0].save(path, "WEBP", quality=70, method=4)
        return True
    frames[0].save(path, "WEBP", save_all=True, append_images=frames[1:], duration=durs, loop=0, quality=50, method=4)
    return os.path.getsize(path) < 600_000


def main():
    key = g.load_env()["GIPHY_API_KEY"]
    raw = open(os.path.join(BASE, "js", "cards_extra.js"), encoding="utf-8").read()
    cards = json.loads(raw[raw.index("= [") + 2: raw.rindex("];") + 1])
    memes = [c for c in cards if c["cat"] == "refs"]
    cache = json.load(open(g.CACHE)) if os.path.exists(g.CACHE) else {}
    rejected = set(json.load(open(g.REJECT))) if os.path.exists(g.REJECT) else set()
    for c in memes:
        cid = c["id"]
        st = cache.get(cid, {})
        if (st.get("found") and cid not in rejected) or st.get("pass2"):
            continue
        q = EXTRA_Q.get(c["name"]) or g.QUERY.get(c["name"]) or c["name"]
        res = []
        for query in [q, q + " meme"]:
            url = "https://api.giphy.com/v1/gifs/search?" + urllib.parse.urlencode({"api_key": key, "q": query, "limit": 12, "rating": "pg-13", "lang": "fr"})
            res = g.http_json(url).get("data", [])
            time.sleep(36)
            if res:
                break
        want = g.tokens(q) | g.tokens(c["name"])
        best, loose = None, False
        for gif in res:
            if want & g.tokens(gif.get("title", "") + " " + gif.get("slug", "")):
                best = gif
                break
        if not best and res:
            best, loose = res[0], True
        entry = {"done": True, "pass2": True, "found": False, "q": q}
        if best:
            img = best["images"]
            src = img["original"] if int(img["original"].get("size", 10**9)) < 3_500_000 else img["downsized"]
            try:
                data = urllib.request.urlopen(urllib.request.Request(src["url"], headers={"User-Agent": "Mozilla/5.0"}), timeout=40).read()
                path = os.path.join(g.CARDS, f"ref_{cid}.webp")
                if small_webp(data, path):
                    entry.update(found=True, loose=loose, title=best.get("title"))
                    print("GIF", c["name"], "<-", best.get("title"), "(loose)" if loose else "", flush=True)
            except Exception as e:
                print("échec", c["name"], e, flush=True)
        cache[cid] = entry
        json.dump(cache, open(g.CACHE, "w"), ensure_ascii=False, indent=0)
    print("FINI", flush=True)


if __name__ == "__main__":
    main()
