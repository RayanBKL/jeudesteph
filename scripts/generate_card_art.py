#!/usr/bin/env python3
"""
THE ASHTRAY KING — Illustrations générées pour les cartes sans photo
Pour chaque carte de scripts/data/images_todo.json dont l'image manque encore
(pas de photo libre trouvée, photo écartée, ou mème), dessine une illustration 320×420 :
  • mème        → la phrase culte en gros, façon mème (Impact blanc contour noir)
  • cigarette   → un paquet dessiné à la marque de la carte
  • briquet     → un briquet / accessoire dessiné
  • drogue      → un sachet zippé étiqueté
  • autre       → une affiche « culte » avec le titre
Usage : python3 scripts/generate_card_art.py   (après download_extra_images.py)
"""
import hashlib
import json
import math
import os
import re
re_nbsp = re.compile(r" ([?!:;»])")

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "scripts", "data")
CARDS = os.path.join(BASE, "assets", "cards")
PREFIX = {"cigarette": "cig", "alcool": "alc", "briquet": "acc", "beauf": "ter", "actrice": "act", "drogue": "drg",
          "foot": "fbl", "refs": "ref", "chanteur": "mus", "culte": "cul"}
W, H = 320, 420
F_GAME = os.path.join(DATA, "cendrier.ttf")
F_IMPACT = "/System/Library/Fonts/Supplemental/Impact.ttf"
F_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
INK = (18, 10, 4)

PALETTE = [(226, 50, 43), (47, 111, 214), (46, 158, 68), (201, 138, 18), (163, 92, 240), (214, 60, 156), (30, 30, 30), (240, 236, 226)]


def h(s, mod):
    return int(hashlib.md5(s.encode()).hexdigest(), 16) % mod


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.truetype(F_BOLD, size)


def wrap(draw, text, fnt, max_w):
    # « ? », « ! », « : » restent collés au mot précédent (espace insécable)
    text = re_nbsp.sub("\u00a0\\1", text)
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit(draw, text, path, max_w, max_h, start, minimum=12, spacing=1.08):
    size = start
    while size > minimum:
        f = font(path, size)
        lines = wrap(draw, text, f, max_w)
        hh = len(lines) * size * spacing
        if hh <= max_h and all(draw.textlength(l, font=f) <= max_w for l in lines):
            return f, lines, size
        size -= 2
    f = font(path, minimum)
    return f, wrap(draw, text, f, max_w), minimum


def draw_lines(draw, lines, f, size, cx, top, fill, stroke=0, stroke_fill=INK, spacing=1.08):
    y = top
    for l in lines:
        w = draw.textlength(l, font=f)
        draw.text((cx - w / 2, y), l, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
        y += size * spacing
    return y


def gradient(c1, c2):
    img = Image.new("RGB", (W, H), c1)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3)))
    return img


def darker(c, k=0.55):
    return tuple(int(x * k) for x in c)


def lighter(c, k=0.45):
    return tuple(int(x + (255 - x) * k) for x in c)


def halftone(img, color, step=14, r=2):
    d = ImageDraw.Draw(img)
    for y in range(0, H, step):
        for x in range((y // step % 2) * step // 2, W, step):
            d.ellipse([x - r, y - r, x + r, y + r], fill=color)


def sunburst(img, center, color, rays=18):
    d = ImageDraw.Draw(img)
    cx, cy = center
    for i in range(rays):
        a1 = 2 * math.pi * i / rays
        a2 = a1 + math.pi / rays
        d.polygon([(cx, cy), (cx + 600 * math.cos(a1), cy + 600 * math.sin(a1)), (cx + 600 * math.cos(a2), cy + 600 * math.sin(a2))], fill=color)


# ── Styles ────────────────────────────────────────────────────
def art_meme(cid, quote):
    c = PALETTE[h(cid, 6)]
    img = gradient(darker(c, 0.75), darker(c, 0.3))
    halftone(img, darker(c, 0.6))
    d = ImageDraw.Draw(img)
    f, lines, size = fit(d, quote, F_IMPACT, W - 40, H - 90, 72, 20)
    total = len(lines) * size * 1.08
    draw_lines(d, lines, f, size, W / 2, (H - total) / 2 - 6, (255, 255, 255), stroke=max(3, size // 12))
    d.rectangle([0, 0, W - 1, H - 1], outline=INK, width=6)
    return img


def art_pack(cid, name):
    bg = PALETTE[(h(cid, 8) + 3) % 8]
    img = gradient(lighter((255, 214, 150), 0.2), (226, 150, 70))
    sunburst(img, (W / 2, H * 0.42), (255, 230, 170))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = 70, 110, 250, 380
    # cigarettes qui dépassent
    for i, cx in enumerate([110, 140, 170]):
        top = y0 - 48 + (i % 2) * 14
        d.rectangle([cx, top, cx + 22, y0 + 10], fill=(251, 240, 216), outline=INK, width=3)
        d.rectangle([cx, top, cx + 22, top + 20], fill=(255, 157, 28), outline=INK, width=3)
    # paquet
    d.rounded_rectangle([x0 + 6, y0 + 8, x1 + 6, y1 + 8], 10, fill=INK)
    d.rounded_rectangle([x0, y0, x1, y1], 10, fill=bg, outline=INK, width=4)
    d.rectangle([x0 + 2, y0 + 2, x1 - 2, y0 + 40], fill=lighter(bg, 0.85) if bg != (240, 236, 226) else (226, 50, 43))
    d.line([(x0, y0 + 42), (x1, y0 + 42)], fill=INK, width=3)
    txt = (255, 255, 255) if sum(bg) < 500 else INK
    f, lines, size = fit(d, name.upper(), F_GAME, x1 - x0 - 24, 90, 40, 14)
    draw_lines(d, lines, f, size, (x0 + x1) / 2, y0 + 60, txt, stroke=2 if txt == (255, 255, 255) else 0)
    # avertissement
    d.rectangle([x0 + 12, y1 - 82, x1 - 12, y1 - 14], fill=(255, 255, 255), outline=INK, width=3)
    fw = font(F_BOLD, 22)
    for i, l in enumerate(["FUMER", "TUE"]):
        w = d.textlength(l, font=fw)
        d.text(((x0 + x1) / 2 - w / 2, y1 - 76 + i * 28), l, font=fw, fill=INK)
    return img


def art_lighter(cid, name):
    bg = PALETTE[(h(cid, 8) + 1) % 8]
    img = gradient((58, 40, 25), (26, 18, 12))
    sunburst(img, (W / 2, 120), (78, 55, 34))
    d = ImageDraw.Draw(img)
    # flamme
    d.polygon([(160, 30), (190, 90), (160, 120), (130, 90)], fill=(255, 196, 58), outline=INK)
    d.polygon([(160, 62), (174, 95), (160, 110), (146, 95)], fill=(255, 106, 40))
    # tête métal + corps
    d.rounded_rectangle([118, 112, 202, 160], 6, fill=(201, 194, 180), outline=INK, width=4)
    for x in range(126, 200, 10):
        d.line([(x, 118), (x, 154)], fill=(150, 144, 132), width=2)
    d.rounded_rectangle([108, 160, 212, 300], 14, fill=bg, outline=INK, width=4)
    d.rounded_rectangle([118, 172, 134, 288], 6, fill=lighter(bg, 0.5))
    f, lines, size = fit(d, name.upper(), F_GAME, W - 40, 90, 34, 14)
    draw_lines(d, lines, f, size, W / 2, 318, (255, 196, 58), stroke=2)
    return img


def art_bag(cid, name):
    content = [(110, 72, 40), (245, 245, 240), (80, 160, 60), (230, 120, 190), (120, 90, 200), (240, 200, 90)][h(cid, 6)]
    img = gradient((40, 46, 52), (14, 16, 20))
    d = ImageDraw.Draw(img)
    # sachet
    d.rounded_rectangle([70, 60, 250, 330], 14, fill=(214, 226, 230), outline=INK, width=4)
    d.rectangle([70, 60, 250, 92], fill=(170, 190, 196), outline=INK, width=4)
    d.line([(78, 100), (242, 100)], fill=(226, 50, 43), width=5)
    d.ellipse([100, 190, 220, 300], fill=content, outline=INK, width=3)
    d.ellipse([125, 175, 195, 245], fill=lighter(content, 0.25), outline=INK, width=3)
    # étiquette
    d.rounded_rectangle([40, 300, 280, 395], 10, fill=(246, 233, 204), outline=INK, width=4)
    f, lines, size = fit(d, name.upper(), F_GAME, 220, 76, 30, 12)
    total = len(lines) * size * 1.08
    draw_lines(d, lines, f, size, W / 2, 347 - total / 2, INK)
    return img


def art_poster(cid, name, cat):
    c = {"culte": (47, 111, 214), "chanteur": (163, 92, 240)}.get(cat, PALETTE[h(cid, 6)])
    img = gradient(darker(c, 0.9), darker(c, 0.35))
    sunburst(img, (W / 2, H / 2), darker(c, 0.75), 24)
    d = ImageDraw.Draw(img)
    d.rectangle([14, 14, W - 15, H - 15], outline=(255, 196, 58), width=4)
    d.rectangle([22, 22, W - 23, H - 23], outline=INK, width=2)
    for k in (-1, 0, 1):  # trois étoiles dessinées
        cx, cy, r = W / 2 + k * 34, 60, 13
        pts = [(cx + (r if i % 2 == 0 else r * 0.45) * math.cos(-math.pi / 2 + i * math.pi / 5),
                cy + (r if i % 2 == 0 else r * 0.45) * math.sin(-math.pi / 2 + i * math.pi / 5)) for i in range(10)]
        d.polygon(pts, fill=(255, 196, 58), outline=INK)
    f, lines, size = fit(d, name.upper(), F_GAME, W - 64, 230, 58, 16)
    total = len(lines) * size * 1.08
    draw_lines(d, lines, f, size, W / 2, (H - total) / 2 + 10, (255, 255, 255), stroke=3)
    return img


def main():
    raw = open(os.path.join(BASE, "js", "cards_extra.js"), encoding="utf-8").read()
    cards = json.loads(raw[raw.index("= [") + 2: raw.rindex("];") + 1])
    names = {c["id"]: c["name"] for c in cards}
    todo = json.load(open(os.path.join(DATA, "images_todo.json")))
    made = {}
    for e in todo:
        path = os.path.join(CARDS, f"{PREFIX[e['cat']]}_{e['id']}.webp")
        if os.path.exists(path):
            continue
        name = names.get(e["id"], e["id"])
        if e["cat"] == "refs":
            img = art_meme(e["id"], e.get("gen") or name.upper())
        elif e["cat"] == "cigarette":
            img = art_pack(e["id"], name)
        elif e["cat"] == "briquet":
            img = art_lighter(e["id"], name)
        elif e["cat"] == "drogue":
            img = art_bag(e["id"], name)
        else:
            img = art_poster(e["id"], name, e["cat"])
        img.save(path, "WEBP", quality=82, method=5)
        made[e["cat"]] = made.get(e["cat"], 0) + 1
    print("illustrations générées", made)


if __name__ == "__main__":
    main()
