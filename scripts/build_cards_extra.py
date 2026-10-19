#!/usr/bin/env python3
"""
THE ASHTRAY KING — Génère les cartes supplémentaires (js/cards_extra.js)

Sources :
  scripts/data/wikidata/*.json   (requêtes Wikidata : foot, actrices, boissons, terroir, tabac, foot_teams)
  scripts/data/drogues_rue.json  (substances écrites à la main, ton « rue »)
  scripts/data/legendes_foot.json (descriptions écrites à la main des légendes du foot)

Sorties :
  js/cards_extra.js              (window.EMPIRE_EXTRA_ITEMS)
  scripts/data/images_todo.json  (images à télécharger : id, url, type de cadrage)
  data/image_credits.json        (fichier Wikimedia Commons de chaque photo)

Usage : python3 scripts/build_cards_extra.py
"""
import hashlib
import json
import os
import re
import subprocess
import unicodedata
import urllib.parse

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "scripts", "data")
WD = os.path.join(DATA, "wikidata")

TARGETS = {  # cartes à ajouter (en plus de l'existant) pour viser ~1000 par famille
    "foot": 1100,
    "actrice": 1000,
    "alcool": 1000,
    "beauf": 1000,
    "tabac": 1000,
}

RARITIES = ["commune", "peu-commune", "rare", "epique", "legendaire", "mythique"]
RCFG = {
    "commune": (0.05, 0.1, 25), "peu-commune": (0.2, 0.3, 100), "rare": (0.8, 0.8, 500),
    "epique": (3.0, 2.0, 2500), "legendaire": (12.0, 6.0, 15000), "mythique": (50.0, 20.0, 100000),
}
# Répartition par notoriété (du plus connu au moins connu)
SPLIT = [("mythique", 0.008), ("legendaire", 0.025), ("epique", 0.07), ("rare", 0.17), ("peu-commune", 0.30), ("commune", 1.0)]


# ── Outils ────────────────────────────────────────────────────
def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", s)


def slug(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s)).strip("-")[:60]


def pick(seed, options):
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    return options[h % len(options)]


def jitter(seed, v):
    h = int(hashlib.md5(("j" + seed).encode()).hexdigest(), 16)
    k = 0.85 + (h % 3000) / 10000  # 0,85 → 1,15
    return round(v * k, 2) if v < 100 else int(round(v * k))


def stats(rarity, seed):
    cps, click, val = RCFG[rarity]
    return {"cashPerSec": jitter(seed, cps), "clickBoost": jitter(seed + "c", click), "value": jitter(seed + "v", val)}


def assign_rarities(items):
    n = len(items)
    out, i = [], 0
    for rarity, upto in SPLIT:
        limit = max(i + (1 if rarity != "commune" else 0), int(round(n * upto)))
        while i < min(limit, n):
            out.append(rarity)
            i += 1
    while len(out) < n:
        out.append("commune")
    return out


def load_rows(name):
    path = os.path.join(WD, name + ".json")
    if not os.path.exists(path):
        print("  (absent)", name)
        return {}
    rows = json.load(open(path))
    items = {}
    for r in rows:
        q = r["p"]["value"].rsplit("/", 1)[1]
        it = items.setdefault(q, {"q": q, "label": r.get("pLabel", {}).get("value", ""), "desc": r.get("pDescription", {}).get("value", ""),
                                  "links": int(r.get("links", {}).get("value", 0) or 0), "img": None, "multi": {}})
        if not it["img"] and r.get("img"):
            it["img"] = re.split(r"%3F|\?", r["img"]["value"].split("/Special:FilePath/")[-1])[0]
            it["img"] = "http://commons.wikimedia.org/wiki/Special:FilePath/" + it["img"]
        for k in ("birth", "posLabel", "countryLabel", "makerLabel", "typeLabel", "regionLabel", "en"):
            if r.get(k):
                it["multi"].setdefault(k, [])
                if r[k]["value"] not in it["multi"][k]:
                    it["multi"][k].append(r[k]["value"])
    return items


def first(it, k):
    v = it["multi"].get(k) or []
    v = [x for x in v if not re.match(r"^Q\d+$", x)]
    return v[0] if v else ""


def year(it):
    b = first(it, "birth")
    return b[:4] if re.match(r"^\d{4}", b) else ""


GENERIC = {"sauce", "nourriture", "plat", "dessert", "boisson", "boisson alcoolisée", "aliment", "repas", "cuisine", "mets",
           "pâtisserie", "fromage", "vin", "bière", "alcool", "spiritueux", "cocktail", "condiment", "épice", "pain", "viande",
           "charcuterie", "soupe", "salade", "légume", "fruit", "huile", "préparation culinaire", "gâteau", "biscuit", "confiserie"}


def is_label_ok(label):
    return label and not re.match(r"^Q\d+$", label) and len(label) <= 48 and label.lower() not in GENERIC


ENGLISH = re.compile(r"\b(the|and|of|from|brand|beer|brewery|wine|liquor|made|with|produced|actress|player|former|drink|company|in)\b", re.I)


def french(d):
    """Garde la description Wikidata seulement si elle est en français."""
    return d if d and not ENGLISH.search(d) else ""


def elide(word, phrase):
    """« de » + mot : élision devant une voyelle (au poste d'attaquant)."""
    return (word[:-1] + "'" if phrase[:1].lower() in "aeiouyéèêh" else word + " ") + phrase


def is_drink(it):
    return bool(re.search(r"boisson|bière|vin\b|vins|cocktail|cidre|cognac|eau-de-vie|liqueur|apéritif|spiritueu|whisky|rhum|vodka|champagne|armagnac|calvados|pastis|soda|limonade",
                          (first(it, "typeLabel") + " " + it["desc"]).lower()))


PREP_MASC = {"Japon", "Mexique", "Portugal", "Danemark", "Royaume-Uni", "Brésil", "Canada", "Pérou", "Chili", "Maroc", "Liban",
             "Luxembourg", "Viêt Nam", "Vietnam", "Venezuela", "Kenya", "Nigeria", "Sénégal", "Cameroun", "Ghana", "Pakistan",
             "Cambodge", "Laos", "Népal", "Salvador", "Guatemala", "Honduras", "Nicaragua", "Panama", "Paraguay", "Costa Rica",
             "Zimbabwe", "Mozambique", "Liechtenstein", "Monténégro", "Kazakhstan", "Qatar", "Koweït", "Bénin", "Togo", "Gabon",
             "Congo", "Tchad", "Niger", "Mali", "Burkina Faso", "Sri Lanka", "Bangladesh", "Groenland", "Québec", "Pays de Galles"}
PREP_PLUR = {"États-Unis", "Pays-Bas", "Caraïbes", "Antilles", "Philippines", "Émirats arabes unis", "Comores", "Seychelles", "Bahamas", "Maldives"}


def de_pays(p):
    if not p:
        return ""
    if p in PREP_PLUR:
        return "des " + p
    if p in PREP_MASC:
        return "du " + p
    if p[0] in "AEIOUYÉÈÊÂÎÔ":
        return "d'" + p
    return "de " + p


def cap(s):
    return s[:1].upper() + s[1:] if s else s


def commons_file(url):
    return urllib.parse.unquote(url.rsplit("/", 1)[1]) if url else None


# ── Existant (pour ne pas créer de doublons) ─────────────────
def existing():
    js = """
const fs=require('fs'),vm=require('vm');const ctx={console:{log(){}}};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/cigarettes_db.js','js/empire_db_expansion.js','js/empire_db.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
console.log(JSON.stringify(ctx.getAllBaseItemsList().map(i=>[i.id,i.name,i.cat])));"""
    out = subprocess.check_output(["node", "-e", js], cwd=BASE)
    return json.loads(out)


# ── Phrases ──────────────────────────────────────────────────
POS = {
    "gardien": ["Des gants plus larges que des boîtes à pizza.", "Le dernier rempart, et le premier à râler sur sa défense.",
                "Plonge comme un chat sur un pigeon.", "Tient ses cages comme le patron tient son comptoir."],
    "défenseur": ["Tacle d'abord, pose les questions après.", "Un mur qu'aucun attaquant n'a envie de croiser deux fois.",
                  "Relance propre, tacle sale, cheveux impeccables.", "Le genre de défenseur qui garde les crampons pour le café d'après-match."],
    "milieu": ["Les poumons de l'équipe, et pas grâce à la clope.", "Distribue les ballons comme le buraliste rend la monnaie.",
               "Court quinze kilomètres par match sans jamais s'essouffler.", "Voit des passes que personne d'autre n'imagine."],
    "attaquant": ["Toujours le premier à fêter un but, même ceux des autres.", "Un renard des surfaces, toujours au bon endroit.",
                  "Une frappe qui fait trembler les filets et les tribunes.", "Le cauchemar des gardiens du dimanche soir."],
    "": ["Sa vignette faisait des jaloux dans les cours de récré.", "Un nom que les commentateurs prononcent en hurlant.",
         "Une carte qu'on échangeait contre trois autres à la récré.", "Les supporters chantent encore son nom au PMU du coin."],
}


def pos_family(p):
    p = (p or "").lower()
    if "gardien" in p:
        return "gardien"
    if "défenseur" in p or "arrière" in p or "libéro" in p:
        return "défenseur"
    if "milieu" in p:
        return "milieu"
    if "attaquant" in p or "avant-centre" in p or "ailier" in p or "buteur" in p:
        return "attaquant"
    return ""


OVR = {"commune": (58, 68), "peu-commune": (68, 74), "rare": (74, 80), "epique": (80, 85), "legendaire": (85, 89), "mythique": (90, 94)}
POS_CODE = {"gardien": "GB", "défenseur": "DEF", "milieu": "MIL", "attaquant": "ATT"}


def foot_meta(it, rarity, cid, teams):
    """Données de l'Ultimate Team : poste, nationalité, clubs, note générale."""
    fam = pos_family(first(it, "posLabel")) or pick(cid + "p", ["milieu", "attaquant", "défenseur"])
    lo, hi = OVR[rarity]
    h = int(hashlib.md5(("o" + cid).encode()).hexdigest(), 16)
    clubs = [c for c in teams.get(it["q"], []) if not re.match(r"(?i)^(équipe|selección)", c) and not re.search(r" (B|II|U-?\d+|Reserves?)$", c)][:4]
    return {"pos": POS_CODE[fam], "nat": first(it, "countryLabel") or "", "clubs": clubs, "ovr": lo + h % (hi - lo + 1)}


def foot_desc(it, teams, legends):
    if it["label"] in legends:
        return legends[it["label"]]
    pos = first(it, "posLabel")
    y = year(it)
    d = french(it["desc"]) or "footballeur"
    d = re.sub(r"^(ancien |entraîneur et ancien )", "", d)
    base = cap(d)
    if y:
        base += f" né en {y}"
    if pos:
        base += ", au poste " + elide("de", pos.lower())
    base += "."
    tl = teams.get(it["q"], [])[:2]
    if tl:
        base += " Passé par " + (" et ".join(tl)) + "."
    return base + " " + pick(it["q"], POS[pos_family(pos)])


ACT_QUIPS = ["Une carte très recherchée au Carré VIP.", "Elle a plus de fans que le PMU du coin a d'habitués.",
             "Son autographe vaut plus cher que la cote de la carte.", "Une habituée des salons et des cérémonies du milieu.",
             "Le genre de nom qui fait lever un sourcil au comptoir.", "Une valeur sûre de la Bourse des collectionneurs.", "Son nom circule plus vite que les cartes Pokémon dans les cours de collège.",
             "Une figure connue bien au-delà de son pays.", "Les collectionneurs se l'arrachent à la Bourse.",
             "Une carrière plus longue que la file d'attente du bureau de tabac.", "Une star de l'industrie, reconnue par le public du milieu."]


def actrice_desc(it):
    c = first(it, "countryLabel")
    d = french(it["desc"]) or ("actrice de films X" + (" originaire " + de_pays(c) if c else ""))
    d = d.replace("actrice pornographique", "actrice de films X").replace("pornographic film actress", "actrice de films X")
    y = year(it)
    base = cap(d) + (f", née en {y}" if y else "") + "."
    return base + " " + pick(it["q"], ACT_QUIPS)


DRINK_QUIPS = {
    "bière": ["À servir bien fraîche en terrasse, la mousse au ras du verre.", "Le compagnon officiel des matchs du dimanche.",
              "Commandée en pinte, terminée en chantant.", "Une bière qui a fait le tour des comptoirs d'Europe."],
    "vin": ["À déboucher pour les grandes occasions, ou un mardi soir sans raison.", "Le tonton la goûte toujours en faisant des bruits de bouche.",
            "Une étiquette qui fait sérieux sur la nappe à carreaux."],
    "cocktail": ["Servi avec une ombrelle en papier et beaucoup trop de glaçons.", "Le barman le prépare en faisant tourner les bouteilles.",
                 "Commandé pour faire classe, regretté le lendemain."],
    "soda": ["Des bulles, du sucre et des souvenirs d'anniversaires d'enfance.", "À boire bien frais, de préférence à la paille."],
    "": ["Une bouteille qui trône fièrement derrière le comptoir.", "Le patron la sort pour les habitués.", "Un classique des tournées générales."],
}


def drink_family(t, desc):
    s = (t + " " + desc).lower()
    if any(k in s for k in ("bière", "beer", "pils", "lager", "ale", "stout", "brasserie", "trappiste", "tripel")):
        return "bière"
    if "cocktail" in s:
        return "cocktail"
    if any(k in s for k in ("soda", "soft drink", "boisson gazeuse", "cola", "limonade")):
        return "soda"
    if any(k in s for k in ("vin", "wine", "appellation", "cépage", "champagne", "doc", "aoc")):
        return "vin"
    return ""


def drink_desc(it):
    t = first(it, "typeLabel")
    c = first(it, "countryLabel")
    m = first(it, "makerLabel")
    d = french(it["desc"])
    base = cap(d) if d else cap(french(t) or "boisson")
    if c and c.lower() not in base.lower():
        base += f", {'venue ' if base.lower().startswith(('bière', 'marque', 'boisson', 'liqueur', 'eau')) else 'venu '}{de_pays(c)}"
    if m and m.lower() not in base.lower() and not re.match(r"^Q\d+$", m):
        base += f", signée {m}"
    return base + ". " + pick(it["q"], DRINK_QUIPS[drink_family(t, d)])


FOOD_QUIPS = ["Le genre de spécialité qui finit toujours au repas de famille du dimanche.", "Mamie a sa recette, et elle ne la donnera jamais.",
              "Se déguste avec une baguette et beaucoup de patience.", "Un classique de la nappe à carreaux.",
              "Le voisin jure que la sienne est meilleure.", "Toute une région se dispute encore la vraie recette.",
              "À commander en terrasse avec un ballon de rouge.", "Un trésor national, à défendre contre les touristes."]


def food_desc(it):
    d = french(it["desc"])
    r = first(it, "regionLabel")
    base = cap(d) if d and len(d) > 12 else "Spécialité du terroir français" + (f" ({d})" if d else "")
    if r and r.lower() not in base.lower() and not re.match(r"^Q\d+$", r):
        base += f", de {r}" if r[0] not in "AEIOUYÉ" else f", d'{r}"
    return base + ". " + pick(it["q"], FOOD_QUIPS)


TABAC_QUIPS = ["Un paquet qu'on retrouve au fond de toutes les boîtes à gants.", "Le buraliste le range toujours tout en haut à droite.",
               "Une marque qui a fait tousser des générations entières.", "Les anciens en parlent avec des trémolos dans la voix.",
               "Ramenée d'un voyage par un cousin, jamais retrouvée en France depuis.", "Le paquet que fumait le patron du PMU dans les années 80.",
               "Introuvable chez ton buraliste, ce qui la rend d'autant plus précieuse.", "Une affiche de cette marque traîne encore dans un café de province.",
               "Le genre de paquet qu'on trouve dans les valises au retour des vacances.", "Les collectionneurs s'arrachent les vieux paquets."]


MUSIC_QUIPS = ["Ses refrains passent encore dans toutes les soirées.", "Le genre d'artiste qu'on chante faux sous la douche.",
               "Un nom que tout le monde connaît, même ceux qui disent ne pas écouter.", "Ses concerts affichent complet en quelques minutes.",
               "Le DJ du mariage le passe toujours après minuit.", "Une voix qu'on reconnaît dès la première note.",
               "Ses albums tournaient en boucle dans la voiture de papa.", "Un incontournable des playlists du comptoir.",
               "Les fans connaissent tous les textes par cœur.", "Un artiste qui a marqué une génération entière."]


NAT_FR = {"American": "des États-Unis", "British": "du Royaume-Uni", "English": "d'Angleterre", "Scottish": "d'Écosse", "Welsh": "du Pays de Galles",
          "Irish": "d'Irlande", "Canadian": "du Canada", "Australian": "d'Australie", "Jamaican": "de Jamaïque", "Barbadian": "de la Barbade",
          "Puerto Rican": "de Porto Rico", "Colombian": "de Colombie", "Mexican": "du Mexique", "Cuban": "de Cuba", "Brazilian": "du Brésil",
          "Spanish": "d'Espagne", "Italian": "d'Italie", "German": "d'Allemagne", "Swedish": "de Suède", "Norwegian": "de Norvège", "Dutch": "des Pays-Bas",
          "Danish": "du Danemark", "Belgian": "de Belgique", "South Korean": "de Corée du Sud", "Nigerian": "du Nigeria", "Senegalese": "du Sénégal",
          "Malian": "du Mali", "Algerian": "d'Algérie", "Moroccan": "du Maroc", "Congolese": "du Congo", "Ghanaian": "du Ghana", "New Zealand": "de Nouvelle-Zélande",
          "Dominican": "de République dominicaine", "Venezuelan": "du Venezuela", "Argentine": "d'Argentine", "Lebanese": "du Liban", "Egyptian": "d'Égypte"}
GENRE_FR = [("rap", "rap"), ("hip hop", "rap"), ("DJ", "DJ et de l'électro"), ("record producer", "production musicale"), ("rock", "rock"),
            ("band", "musique"), ("country", "country"), ("reggae", "reggae"), ("opera", "l'opéra"), ("tenor", "l'opéra"), ("pop", "pop"),
            ("singer", "chanson"), ("musician", "musique")]


def music_desc(it):
    en = (it.get("multi", {}).get("en") or [""])[0] if it.get("multi") else ""
    if en:
        genre = next((g for k, g in GENRE_FR if k.lower() in en.lower()), "musique")
        nat = next((v for k, v in NAT_FR.items() if en.startswith(k)), "")
        art = "du " if genre in ("rap", "rock", "reggae") else "de la " if genre in ("pop", "chanson", "musique", "country", "production musicale") else "de "
        if genre.startswith("l'") or genre.startswith("DJ"):
            art = "de " if genre.startswith("l'") else ""
        base = f"Star {art}{genre}" + (f" venue {nat}" if nat else " internationale") + "."
        return base.replace("Star DJ", "Star du DJing").replace("Star de l'opéra", "Star de l'opéra") + " " + pick(it["q"], MUSIC_QUIPS)
    d = french(it["desc"]) or "artiste"
    y = year(it)
    base = cap(d) + (f", né{'e' if re.search(r'chanteuse|rappeuse|autrice|musicienne|actrice', d) else ''} en {y}" if y else "") + "."
    return base + " " + pick(it["q"], MUSIC_QUIPS)


def tabac_desc(it):
    d = french(it["desc"]) or french(first(it, "typeLabel")) or "marque de tabac"
    if d.lower() in ("marque de cigarette", "marque de cigarettes"):
        d = pick(it["q"] + "d", ["Marque de cigarettes", "Paquet de cigarettes", "Marque de clopes", "Cigarettes en paquet de 20"])
    c = first(it, "countryLabel")
    m = first(it, "makerLabel")
    base = cap(d)
    if c and c.lower() not in base.lower():
        base += f", {de_pays(c)}".replace(", de ", ", originaire de ").replace(", d'", ", originaire d'").replace(", du ", ", originaire du ").replace(", des ", ", originaire des ")
    if m and m.lower() not in base.lower():
        base += f", fabriquée par {m}"
    return base + ". " + pick(it["q"], TABAC_QUIPS)


def wikidata_image(title):
    """Photo (P18) de l'élément Wikidata lié à l'article Wikipédia français « title »."""
    import time
    import urllib.request
    url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
        {"action": "wbgetentities", "sites": "frwiki", "titles": title, "props": "claims", "format": "json"})
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AshtrayKingCardBuilder/1.0 (jeu satirique)"})
            data = json.load(urllib.request.urlopen(req, timeout=20))
            time.sleep(0.4)
            for ent in data.get("entities", {}).values():
                p18 = ent.get("claims", {}).get("P18")
                if p18:
                    name = p18[0]["mainsnak"]["datavalue"]["value"]
                    return "http://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(name)
            return None
        except Exception:
            time.sleep(5)
    return None


# ── Construction ──────────────────────────────────────────────
def main():
    ex = existing()
    taken_ids = {e[0] for e in ex}
    taken_names = {norm(e[1]) for e in ex}
    count_by_cat = {}
    for _, _, cat in ex:
        count_by_cat[cat] = count_by_cat.get(cat, 0) + 1
    legends = json.load(open(os.path.join(DATA, "legendes_foot.json")))

    teams = {}
    # Tous les clubs de la carrière (foot_teams_all) ; sinon seulement le club « préféré » (foot_teams)
    tpath = os.path.join(WD, "foot_teams_all.json")
    if not os.path.exists(tpath):
        tpath = os.path.join(WD, "foot_teams.json")
    if os.path.exists(tpath):
        rows = json.load(open(tpath))
        tmp = {}
        for r in rows:
            q = r["p"]["value"].rsplit("/", 1)[1]
            lab = r.get("teamLabel", {}).get("value", "")
            if lab and not re.match(r"^Q\d+$", lab) and not re.match(r"(?i)^(équipe|selección|national)", lab) and "national" not in lab.lower():
                tmp.setdefault(q, []).append((int(r.get("tl", {}).get("value", 0)), lab))
        for q, lst in tmp.items():
            seen = []
            for _, lab in sorted(lst, reverse=True):
                if lab not in seen:
                    seen.append(lab)
            teams[q] = seen

    cards, images, credits = [], [], {}

    def add(cat, prefix, items, desc_fn, emoji, need, kind, max_rarity=None):
        items = [i for i in items if is_label_ok(i["label"]) and norm(i["label"]) not in taken_names and (i["img"] or kind == "brand")]
        items.sort(key=lambda i: -i["links"])
        items = items[:max(0, need)]
        # Doublons à l'intérieur d'une même liste (même nom vu deux fois)
        uniq, seen_n = [], set()
        for it in items:
            if norm(it["label"]) not in seen_n:
                seen_n.add(norm(it["label"]))
                uniq.append(it)
        if cat == "chanteur":   # uniquement pour la musique : les autres familles gardent leurs cartes existantes
            items = uniq
        rar = assign_rarities(items)
        if max_rarity:
            cap_i = RARITIES.index(max_rarity)
            rar = [RARITIES[min(RARITIES.index(r), cap_i)] for r in rar]
        for it, r in zip(items, rar):
            cid = f"{prefix}-{slug(it['label'])}"
            n = 2
            while cid in taken_ids:
                cid = f"{prefix}-{slug(it['label'])}-{n}"
                n += 1
            taken_ids.add(cid)
            taken_names.add(norm(it["label"]))
            card = {"id": cid, "cat": cat, "rarity": r, "name": cap(it["label"]), "emoji": emoji, **stats(r, cid), "desc": desc_fn(it), "wd": it["q"]}
            if cat == "foot":
                card.update(foot_meta(it, r, cid, teams))
            cards.append(card)
            if it["img"]:
                images.append({"id": cid, "cat": cat, "url": it["img"], "kind": "product" if kind == "brand" else kind})
                credits[cid] = commons_file(it["img"])
            else:
                images.append({"id": cid, "cat": cat, "query": f"{it['label']} {'cigarette pack' if cat == 'cigarette' else 'lighter'}", "kind": "product"})
        return len(items)

    # Football
    foot = [i for i in load_rows("foot").values() if re.search(r"foot|soccer", i["desc"], re.I)
            and not re.search(r"politi|acteur|écrivain|chanteur|physicien|philosophe|pape|prêtre|militaire", i["desc"], re.I)]
    print("foot", add("foot", "fbl", foot, lambda it: foot_desc(it, teams, legends), "⚽", TARGETS["foot"], "portrait"))

    # Actrices X (uniquement si la description confirme le métier)
    act = [i for i in load_rows("actrices").values() if re.search(r"porn|adult|X\b|charme|érotique|film.? pour adultes", i["desc"], re.I)]
    print("actrice", add("actrice", "actrice", act, actrice_desc, "👠", TARGETS["actrice"] - count_by_cat.get("actrice", 0), "portrait"))

    # Boissons (on limite les appellations de vin pour garder de la variété)
    drinks = list(load_rows("boissons").values())
    terroir_rows = list(load_rows("terroir").values())
    drinks += [i for i in terroir_rows if is_drink(i)]
    wine_cap, wines = 160, 0
    kept = []
    for i in sorted(drinks, key=lambda x: -x["links"]):
        if drink_family(first(i, "typeLabel"), i["desc"]) == "vin":
            wines += 1
            if wines > wine_cap:
                continue
        kept.append(i)
    print("alcool", add("alcool", "alc", kept, drink_desc, "🥃", TARGETS["alcool"] - count_by_cat.get("alcool", 0), "product"))

    # Terroirs
    food = [i for i in terroir_rows if not is_drink(i)]
    print("beauf", add("beauf", "ter", food, food_desc, "🧀", TARGETS["beauf"] - count_by_cat.get("beauf", 0), "product"))

    # Tabac & accessoires
    tab = [i for i in load_rows("tabac").values() if not re.search(r"collection|musée|museu|museum|objet|œuvre|oeuvre|louvre", i["desc"], re.I) and not re.search(r"\(.*\d.*\)", i["label"])]
    acc = [i for i in tab if re.search(r"briquet|lighter|papier|paper|pipe|feuille|zippo", first(i, "typeLabel") + " " + i["desc"], re.I)]
    cig = [i for i in tab if i not in acc]
    need = TARGETS["tabac"] - count_by_cat.get("cigarette", 0) - count_by_cat.get("briquet", 0)
    n1 = add("cigarette", "cig", cig, tabac_desc, "🚬", need, "brand")
    n2 = add("briquet", "bri", acc, tabac_desc, "🔥", need - n1, "brand")
    print("tabac", n1, n2)

    # Tabac & comptoir écrits à la main (cigares, tabac à rouler, pipes, briquets, jeux du bureau de tabac…)
    nh = 0
    for cat, name, rarity, desc, q in json.load(open(os.path.join(DATA, "tabac_comptoir.json"))):
        if norm(name) in taken_names:
            continue
        cid = f"{'cig' if cat == 'cigarette' else 'bri'}-{slug(name)}"
        if cid in taken_ids:
            continue
        taken_ids.add(cid)
        taken_names.add(norm(name))
        cards.append({"id": cid, "cat": cat, "rarity": rarity, "name": name, "emoji": "🚬" if cat == "cigarette" else "🔥", **stats(rarity, cid), "desc": desc})
        images.append({"id": cid, "cat": cat, "query": q, "kind": "product"})
        nh += 1
    print("tabac (comptoir)", nh)

    # ── Musique, Refs (mèmes) et Culte ───────────────────────────
    # Chanteurs/rappeurs : Wikidata (musique_fr = français, musique_inter = reste du monde)
    # Filtre strict : la description Wikidata doit commencer par un métier de la musique
    MUSIC_OK = re.compile(r"^(chanteu|rappeu|auteur-compositeur|autrice-compositrice|auteure-compositrice|musicien|groupe|dj\b|disc-jockey|duo|beatmaker|producteur de musique|collectif)", re.I)
    MUSIC_BAN = {"varg vikernes", "gerard depardieu"}
    def music_ok(it):
        return bool(MUSIC_OK.search(it["desc"] or "")) and norm(it["label"]) not in {norm(x) for x in MUSIC_BAN}
    music_fr = list(load_rows("musique_fr2").values()) + [i for i in load_rows("musique_fr").values() if music_ok(i)]
    music_inter = list(load_rows("musique_inter").values())
    music_by_name = {}
    for it in music_fr + music_inter:
        if it["img"] and norm(it["label"]) not in music_by_name:
            music_by_name[norm(it["label"])] = it

    # Refs écrites à la main : chaque entrée a une famille (refs = mème, chanteur, culte)
    refs = json.load(open(os.path.join(DATA, "refs.json")))
    rejected = set(json.load(open(os.path.join(DATA, "images_rejected.json")))) if os.path.exists(os.path.join(DATA, "images_rejected.json")) else set()
    wdcache_path = os.path.join(DATA, "refs_wd_cache.json")
    wdcache = json.load(open(wdcache_path)) if os.path.exists(wdcache_path) else {}
    nr = {"refs": 0, "chanteur": 0, "culte": 0}
    for d in refs:
        cid = f"ref-{slug(d['name'])}"   # identifiant d'origine conservé (sauvegardes des joueurs)
        if cid in taken_ids:
            continue
        taken_ids.add(cid)
        taken_names.add(norm(d["name"]))
        cat = d.get("cat", "refs")
        emoji = {"refs": "📱", "chanteur": "🎤", "culte": "🎬"}[cat]
        card = {"id": cid, "cat": cat, "rarity": d["rarity"], "name": d["name"], "emoji": emoji, **stats(d["rarity"], cid), "desc": d["desc"]}
        old = os.path.join(BASE, "assets", "cards", f"ref_{cid}.webp")
        if cat == "chanteur":
            m = music_by_name.get(norm(d["name"]))
            if m:  # la bonne photo (le chanteur, pas un homonyme)
                images.append({"id": cid, "cat": cat, "url": m["img"], "kind": "portrait"})
                credits[cid] = commons_file(m["img"])
                if os.path.exists(old):
                    os.remove(old)
            elif os.path.exists(old) and cid not in rejected:
                card["img"] = f"assets/cards/ref_{cid}.webp"
            else:
                images.append({"id": cid, "cat": cat, "gen": d["name"].upper(), "kind": "product"})
        else:
            if os.path.exists(old) and cid not in rejected:
                card["img"] = f"assets/cards/ref_{cid}.webp"   # photo déjà téléchargée
            else:
                img = None
                if d.get("wd") and cid not in rejected:
                    img = wdcache.get(d["wd"]) if d["wd"] in wdcache else wikidata_image(d["wd"])
                    wdcache[d["wd"]] = img
                if img:
                    images.append({"id": cid, "cat": cat, "url": img, "kind": "product"})
                    credits[cid] = commons_file(img)
                else:
                    images.append({"id": cid, "cat": cat, "gen": d["name"].upper(), "kind": "product"})
        cards.append(card)
        nr[cat] += 1
    json.dump(wdcache, open(wdcache_path, "w"), ensure_ascii=False, indent=0)
    print("refs écrites à la main", nr)

    # Nouveaux mèmes (illustrés par une image générée : la phrase culte en gros)
    nm = 0
    for name, rarity, quote, desc in json.load(open(os.path.join(DATA, "memes.json"))):
        if norm(name) in taken_names:
            continue
        cid = f"meme-{slug(name)}"
        if cid in taken_ids:
            continue
        taken_ids.add(cid)
        taken_names.add(norm(name))
        cards.append({"id": cid, "cat": "refs", "rarity": rarity, "name": name, "emoji": "📱", **stats(rarity, cid), "desc": desc})
        images.append({"id": cid, "cat": "refs", "gen": quote, "kind": "meme"})
        nm += 1
    print("mèmes", nm)

    # Chanteurs et rappeurs : surtout français
    nfr = add("chanteur", "mus", music_fr, music_desc, "🎤", 460, "portrait", "legendaire")
    nin = add("chanteur", "mus", music_inter, music_desc, "🎤", 260, "portrait", "legendaire")
    print("musique", nfr, "fr +", nin, "inter")

    # Substances (écrites à la main, images à chercher)
    rue = json.load(open(os.path.join(DATA, "drogues_rue.json")))
    nd = 0
    for d in rue:
        if norm(d["name"]) in taken_names:
            continue
        cid = f"dro-{slug(d['name'])}"
        if cid in taken_ids:
            continue
        taken_ids.add(cid)
        cards.append({"id": cid, "cat": "drogue", "rarity": d["rarity"], "name": d["name"], "emoji": "🌿", **stats(d["rarity"], cid), "desc": d["desc"]})
        images.append({"id": cid, "cat": "drogue", "query": d["q"], "kind": "product"})
        nd += 1
    print("drogue", nd)

    # Noms en double : on les distingue (scripts/data/renames.json)
    _ren = json.load(open(os.path.join(DATA, "renames.json"), encoding="utf-8"))
    for _c in cards:
        if _c["id"] in _ren:
            _c["name"] = _ren[_c["id"]]
    with open(os.path.join(BASE, "js", "cards_extra.js"), "w", encoding="utf-8") as f:
        f.write("// Généré par scripts/build_cards_extra.py — ne pas modifier à la main.\n")
        f.write("// Photos : Wikimedia Commons (voir data/image_credits.json).\n")
        f.write("const EMPIRE_EXTRA_ITEMS = ")
        json.dump(cards, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\nif (typeof window !== 'undefined') window.EMPIRE_EXTRA_ITEMS = EMPIRE_EXTRA_ITEMS;\n")
        f.write("if (typeof globalThis !== 'undefined') globalThis.EMPIRE_EXTRA_ITEMS = EMPIRE_EXTRA_ITEMS;\n")
    json.dump(images, open(os.path.join(DATA, "images_todo.json"), "w"), ensure_ascii=False, indent=0)
    os.makedirs(os.path.join(BASE, "data"), exist_ok=True)
    json.dump(credits, open(os.path.join(BASE, "data", "image_credits.json"), "w"), ensure_ascii=False, indent=0)
    by = {}
    for c in cards:
        by[c["cat"]] = by.get(c["cat"], 0) + 1
    print("TOTAL nouvelles cartes", len(cards), by)


if __name__ == "__main__":
    main()
