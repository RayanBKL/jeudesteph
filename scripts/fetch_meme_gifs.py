#!/usr/bin/env python3
"""
THE ASHTRAY KING — GIF animés pour les cartes « Mèmes » (Giphy)

Pour chaque carte de la famille « refs », cherche un GIF sur Giphy, vérifie que le titre
correspond bien au mème (pour éviter les résultats au hasard), puis l'enregistre en
WebP animé à la place de l'illustration (assets/cards/ref_<id>.webp, même chemin).

Clé : GIPHY_API_KEY dans .env (jamais dans le code du jeu). Les clés « beta » sont limitées
à ~100 requêtes/heure : le script va doucement et reprend où il s'est arrêté.
Usage : python3 scripts/fetch_meme_gifs.py
"""
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image, ImageSequence

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(BASE, "assets", "cards")
CACHE = os.path.join(BASE, "scripts", "data", "giphy_cache.json")
REJECT = os.path.join(BASE, "scripts", "data", "giphy_rejected.json")

# Recherches en anglais pour les mèmes dont le nom ne se cherche pas tel quel
QUERY = {
    "6-7": "6 7 meme", "Skibidi Toilet": "skibidi toilet", "Rickroll": "rick astley never gonna give you up", "Nyan Cat": "nyan cat",
    "Doge": "doge meme", "This is Fine": "this is fine dog", "Gangnam Style": "gangnam style", "Harlem Shake": "harlem shake",
    "Sigma": "sigma male", "Chill Guy": "chill guy", "Pedro Pedro Pedro": "pedro raccoon dance", "Distracted Boyfriend": "distracted boyfriend",
    "Stonks": "stonks", "Gigachad": "gigachad", "Trollface": "trollface", "Pepe la Grenouille": "pepe the frog", "Keyboard Cat": "keyboard cat",
    "Grumpy Cat": "grumpy cat", "Bongo Cat": "bongo cat", "Fortnite Floss": "floss dance", "Baby Shark": "baby shark dance",
    "Dancing Coffin": "coffin dance", "Hide the Pain Harold": "hide the pain harold", "Bernie Mittens": "bernie sanders mittens",
    "Chien de la casse": "angry dog", "Tralalero Tralala": "tralalero tralala", "Tung Tung Tung Sahur": "tung tung tung sahur",
    "Ballerina Cappuccina": "ballerina cappuccina", "Bombardiro Crocodilo": "bombardiro crocodilo", "Brr Brr Patapim": "brr brr patapim",
    "Lirili Larila": "lirili larila", "Chimpanzini Bananini": "chimpanzini bananini", "Cappuccino Assassino": "cappuccino assassino",
    "Hawk Tuah": "hawk tuah", "Moo Deng": "moo deng", "Labubu": "labubu", "Very Demure": "very demure", "Brainrot": "brainrot",
    "Fanum Tax": "fanum tax", "Gyatt": "gyatt", "Big Chungus": "big chungus", "Ugandan Knuckles": "ugandan knuckles", "Wojak": "wojak",
    "Sad Pablo Escobar": "sad pablo escobar waiting", "Kermit sipping tea": "kermit sipping tea", "Drake Hotline Bling": "drake hotline bling",
    "Two Buttons": "two buttons sweating", "Expanding Brain": "expanding brain", "Woman Yelling at Cat": "woman yelling at cat",
    "Change My Mind": "steven crowder change my mind", "Surprised Pikachu": "surprised pikachu", "Leonardo DiCaprio Cheers": "dicaprio cheers",
    "Salt Bae": "salt bae", "Roll Safe": "roll safe thinking", "Disaster Girl": "disaster girl", "Success Kid": "success kid",
    "Bad Luck Brian": "bad luck brian", "Ight Imma Head Out": "spongebob ight imma head out", "Mike Wazowski": "mike wazowski",
    "Huh Cat": "huh cat", "Banana Cat": "banana cat crying", "Smurf Cat": "smurf cat", "Dancing Polish Cow": "polish cow dance",
    "Maxwell the Cat": "maxwell cat", "OIIA Cat": "oiia oiia cat", "Floppa": "floppa", "Sad Hamster": "sad hamster", "Cat Vibing": "cat vibing",
    "Dancing Toothless": "toothless dancing", "John Pork": "john pork", "Bing Chilling": "bing chilling john cena", "Absolute Cinema": "absolute cinema",
    "IShowSpeed": "ishowspeed", "Mr Incredible Uncanny": "mr incredible becoming uncanny", "Siuuu": "ronaldo siuuu", "Comment est votre blanquette ?": "oss 117 blanquette",
    "C'est une bonne situation ça, scribe ?": "mission cleopatre scribe", "Casse-toi pauv' con": "sarkozy casse toi", "Non mais allô quoi": "non mais allo quoi",
    "Le gras c'est la vie": "kaamelott le gras c'est la vie", "On en a gros": "kaamelott perceval", "Cassé !": "brice de nice casse",
    "Jusqu'ici tout va bien": "la haine jusqu'ici tout va bien", "Okayyy": "les visiteurs okay", "Ça m'en touche une": "chirac",
}
STOP = {"les", "des", "une", "est", "pas", "que", "qui", "the", "and", "pour", "sur", "dans", "avec", "cat", "meme", "gif"}


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def tokens(s):
    return {t for t in re.findall(r"[a-z0-9]+", norm(s)) if len(t) >= 3 and t not in STOP}


def load_env():
    env = {}
    for line in open(os.path.join(BASE, ".env"), encoding="utf-8"):
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            env[k] = v
    return env


def http_json(url):
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print("limite Giphy atteinte, pause 12 min", flush=True)
                time.sleep(720)
                continue
            raise
        except Exception:
            time.sleep(5)
    return {}


def to_webp(data, path):
    im = Image.open(io.BytesIO(data))
    frames, durs = [], []
    n = getattr(im, "n_frames", 1)
    step = max(1, n // 30)               # 30 images maximum
    for i, fr in enumerate(ImageSequence.Iterator(im)):
        if i % step:
            continue
        f = fr.convert("RGBA")
        w = 300
        f = f.resize((w, max(2, int(f.height * w / f.width))), Image.Resampling.LANCZOS)
        frames.append(f)
        durs.append(max(40, int(fr.info.get("duration", 60)) * step))
    if len(frames) < 2:
        return False
    frames[0].save(path, "WEBP", save_all=True, append_images=frames[1:], duration=durs, loop=0, quality=55, method=4)
    return os.path.getsize(path) < 900_000


def main():
    key = load_env()["GIPHY_API_KEY"]
    raw = open(os.path.join(BASE, "js", "cards_extra.js"), encoding="utf-8").read()
    cards = json.loads(raw[raw.index("= [") + 2: raw.rindex("];") + 1])
    memes = [c for c in cards if c["cat"] == "refs"]
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    rejected = set(json.load(open(REJECT))) if os.path.exists(REJECT) else set()
    done = 0
    for c in memes:
        if c["id"] in rejected:
            continue
        path = os.path.join(CARDS, f"ref_{c['id']}.webp")
        if cache.get(c["id"], {}).get("done"):
            continue
        q = QUERY.get(c["name"], c["name"])
        url = "https://api.giphy.com/v1/gifs/search?" + urllib.parse.urlencode({"api_key": key, "q": q, "limit": 10, "rating": "pg-13", "lang": "fr"})
        res = http_json(url).get("data", [])
        want = tokens(q) | tokens(c["name"])
        best = None
        for g in res:
            hay = tokens(g.get("title", "") + " " + g.get("slug", ""))
            hit = len(want & hay)
            need = 1 if len(want) <= 2 else 2
            if hit >= need:
                best = g
                break
        cache[c["id"]] = {"done": True, "found": bool(best), "title": best.get("title") if best else None, "q": q}
        if best:
            img = best["images"]
            src = img["original"] if int(img["original"].get("size", 10**9)) < 3_500_000 else img["downsized"]
            try:
                data = urllib.request.urlopen(urllib.request.Request(src["url"], headers={"User-Agent": "Mozilla/5.0"}), timeout=40).read()
                if to_webp(data, path):
                    done += 1
                    print("GIF", c["name"], "←", best.get("title"), flush=True)
                else:
                    cache[c["id"]]["found"] = False
            except Exception as e:
                cache[c["id"]]["found"] = False
        json.dump(cache, open(CACHE, "w"), ensure_ascii=False, indent=0)
        time.sleep(36)   # ~100 requêtes/heure
    print("FINI", done, "GIF", flush=True)


if __name__ == "__main__":
    sys.exit(main())
