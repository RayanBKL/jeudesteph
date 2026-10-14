#!/usr/bin/env python3
"""
THE ASHTRAY KING — Télécharge les images des cartes supplémentaires
Lit scripts/data/images_todo.json (généré par build_cards_extra.py) et écrit
assets/cards/<préfixe>_<id>.webp en 320×420 (même format que les cartes existantes).

• « url »   : photo Wikimedia Commons (licence libre, voir data/image_credits.json)
• « query » : recherche d'image (substances, marques sans photo Commons)
Les portraits sont cadrés sur le haut (visage), les objets au centre.
Les fichiers déjà présents sont ignorés : le script peut être relancé.

Usage : python3 scripts/download_extra_images.py
"""
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODO = os.path.join(BASE, "scripts", "data", "images_todo.json")
CARDS = os.path.join(BASE, "assets", "cards")
PREFIX = {"cigarette": "cig", "alcool": "alc", "briquet": "acc", "beauf": "ter", "actrice": "act", "drogue": "drg", "foot": "fbl", "refs": "ref", "chanteur": "mus", "culte": "cul"}
UA_COMMONS = "AshtrayKingCardBuilder/1.0 (jeu satirique, telechargement ponctuel)"
UA_WEB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
BAD = ("shutterstock", "alamy", "depositphotos", "istockphoto", "gettyimages", "dreamstime", "123rf", "freepik", ".svg", "logo")
W, H = 320, 420


def fetch(url, ua, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "image/*,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def commons_thumb(url, width=330):
    """Miniature directe sur thumb.wikimedia.org (upload.wikimedia.org et Special:FilePath sont vite limités).
    Chemin : thumb/<md5[0]>/<md5[0:2]>/<fichier>/<largeur>px-<fichier>"""
    import hashlib
    name = urllib.parse.unquote(url.rsplit("/", 1)[1]).replace(" ", "_")
    h = hashlib.md5(name.encode("utf-8")).hexdigest()
    q = urllib.parse.quote(name)
    thumb = f"https://thumb.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{width}px-{q}"
    if name.lower().endswith((".svg", ".tif", ".tiff")):
        thumb += ".png" if name.lower().endswith(".svg") else ".jpg"
    return thumb


CREDITS = os.path.join(BASE, "data", "image_credits.json")


def search_urls(query):
    """Openverse (images sous licence Creative Commons, réutilisation commerciale autorisée).
    Renvoie [(url, crédit)]."""
    api = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(
        {"q": query, "page_size": 8, "license_type": "commercial", "mature": "false"})
    try:
        data = json.loads(fetch(api, UA_COMMONS, 20).decode("utf-8"))
    except Exception:
        return []
    out = []
    for r in data.get("results", []):
        u = r.get("url") or ""
        if not u or u.lower().endswith(".svg") or any(b in u.lower() for b in BAD):
            continue
        credit = f"{r.get('title', '')} — {r.get('creator') or 'auteur inconnu'} — {r.get('license', '').upper()} {r.get('license_version', '')} — {r.get('foreign_landing_url', '')}"
        out.append((u, credit))
    return out[:6]


def add_credit(card_id, credit):
    try:
        credits = json.load(open(CREDITS))
    except Exception:
        credits = {}
    credits[card_id] = credit
    json.dump(credits, open(CREDITS, "w"), ensure_ascii=False, indent=0)


def save(data, path, kind):
    im = Image.open(io.BytesIO(data))
    im = im.convert("RGB")
    iw, ih = im.size
    target = W / H
    if iw / ih > target:  # trop large : on coupe les côtés
        nw = int(ih * target)
        x = (iw - nw) // 2
        im = im.crop((x, 0, x + nw, ih))
    else:  # trop haut : portrait cadré sur le haut, objet au centre
        nh = int(iw / target)
        y = int((ih - nh) * (0.15 if kind == "portrait" else 0.5))
        im = im.crop((0, y, iw, y + nh))
    im = im.resize((W, H), Image.Resampling.LANCZOS)
    im.save(path, "WEBP", quality=74, method=5)


class RateLimited(Exception):
    pass


REJECTED_FILE = os.path.join(BASE, "scripts", "data", "images_rejected.json")
REJECTED = set(json.load(open(REJECTED_FILE))) if os.path.exists(REJECTED_FILE) else set()


def job(entry):
    path = os.path.join(CARDS, f"{PREFIX[entry['cat']]}_{entry['id']}.webp")
    if os.path.exists(path) or entry["id"] in REJECTED:
        return "skip"  # image déjà là, ou image hors sujet écartée à la main (la carte garde son emblème)
    try:
        if entry.get("url"):
            for attempt in range(3):
                try:
                    try:
                        data = fetch(commons_thumb(entry["url"]), UA_COMMONS)
                    except urllib.error.HTTPError as e:
                        if e.code != 404:
                            raise
                        # Image plus petite que 330 px : on prend l'original
                        data = fetch(entry["url"].replace("http://", "https://"), UA_COMMONS)
                    save(data, path, entry["kind"])
                    return "ok"
                except urllib.error.HTTPError as e:
                    if e.code == 429:
                        raise RateLimited()
                    raise
        for u, credit in (search_urls(entry["query"]) if entry.get("query") else []):
            try:
                data = fetch(u, UA_WEB, 15)
                if len(data) < 3000:
                    continue
                save(data, path, entry["kind"])
                add_credit(entry["id"], credit)
                return "ok"
            except Exception:
                continue
        return "fail"
    except RateLimited:
        raise
    except Exception:
        return "fail"


def main():
    """Une image à la fois, avec un délai qui s'adapte : Wikimedia bloque les rafales (erreur 429)."""
    todo = json.load(open(TODO))
    # Les cartes les plus récentes (refs) d'abord, puis les footballeurs (utiles à l'Ultimate Team)
    order = {"refs": 0, "foot": 1}
    todo.sort(key=lambda t: order.get(t["cat"], 2))
    os.makedirs(CARDS, exist_ok=True)
    stats = {"ok": 0, "skip": 0, "fail": 0}
    failed = []
    delay = 0.4
    for i, entry in enumerate(todo):
        path = os.path.join(CARDS, f"{PREFIX[entry['cat']]}_{entry['id']}.webp")
        if os.path.exists(path):
            stats["skip"] += 1
            continue
        for attempt in range(5):
            try:
                res = job(entry)
                break
            except RateLimited:
                delay = min(15, delay * 1.3)
                print(f"limite atteinte, pause 2 min (délai {delay:.1f} s)", flush=True)
                time.sleep(120)
        else:
            res = "fail"
        stats[res] += 1
        if res == "fail":
            failed.append(entry["id"])
        else:
            delay = max(0.4, delay * 0.95)
        if (stats["ok"] + stats["fail"]) % 50 == 0:
            print(i, len(todo), stats, flush=True)
        time.sleep(delay)
    json.dump(failed, open(os.path.join(BASE, "scripts", "data", "images_failed.json"), "w"), indent=0)
    print("FINI", stats, flush=True)


if __name__ == "__main__":
    sys.exit(main())
