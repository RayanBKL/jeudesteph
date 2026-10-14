#!/usr/bin/env python3
"""
THE ASHTRAY KING — Générateur de la police « Cendrier »
Police d'affichage maison : traits géométriques épais, coins coupés à 45°
(style enseigne de bar-tabac / arcade). Les minuscules sont des petites capitales.

Chaque glyphe est décrit par ses lignes centrales (polylignes) ; shapely les épaissit,
les fusionne et les découpe, fontTools écrit la police.

Usage :
  pip install fonttools==4.54.1 shapely==2.0.6 brotli==1.1.0
  python3 scripts/build_font.py      ->  assets/fonts/cendrier.woff2
"""

import os
import unicodedata

from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union
from shapely import affinity
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen  # noqa: F401  (gardé pour évolutions)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE, "assets", "fonts")

UPM = 1000
CAP = 700          # hauteur des capitales
S = 168            # épaisseur du trait
SB = 50            # approche latérale
SMALL = 0.80       # échelle des petites capitales (minuscules)
K = 130            # taille des pans coupés


# ── Géométrie ─────────────────────────────────────────────────────────────────

def stroke(paths, w):
    """Épaissit des polylignes (coordonnées des lignes centrales)."""
    shapes = []
    for p in paths:
        if isinstance(p, Polygon):
            shapes.append(p)
            continue
        closed = len(p) > 2 and p[0] == p[-1]
        line = LineString(p)
        shapes.append(line.buffer(w / 2, cap_style=2 if closed else 3, join_style=2, mitre_limit=3))
    return unary_union(shapes)


def finish(geom, width, height, bottom=0, clip=True):
    """Découpe dans la boîte du glyphe et adoucit très légèrement les angles saillants."""
    if clip:
        geom = geom.intersection(box(0, bottom, width, height))
    geom = geom.buffer(-6, join_style=2).buffer(6, join_style=3)
    return geom


# Les glyphes sont décrits en coordonnées de lignes centrales :
# x de 0 à r (largeur), y de 0 à t (hauteur). h = demi-trait.

def G(t, r, k):
    """Renvoie le dictionnaire des dessins pour une hauteur t et une largeur r données."""
    m = t / 2
    d = {}
    d["A"] = [[(0, -200), (0, t - k), (k, t), (r - k, t), (r, t - k), (r, -200)], [(0, m * 0.9), (r, m * 0.9)]]
    d["B"] = [[(0, 0), (0, t), (r - k, t), (r - k * 0.3, t - k * 0.7), (r - k * 0.3, m + k * 0.5), (r - k * 0.8, m)],
              [(0, m), (r - k, m), (r, m - k), (r, k), (r - k, 0), (0, 0)]]
    d["C"] = [[(r + 200, t), (k, t), (0, t - k), (0, k), (k, 0), (r + 200, 0)]]
    d["D"] = [[(0, 0), (0, t), (r - k, t), (r, t - k), (r, k), (r - k, 0), (0, 0)]]
    d["E"] = [[(r + 200, t), (0, t), (0, 0), (r + 200, 0)], [(0, m), (r * 0.82, m)]]
    d["F"] = [[(r + 200, t), (0, t), (0, -200)], [(0, m), (r * 0.82, m)]]
    d["G"] = [[(r + 200, t), (k, t), (0, t - k), (0, k), (k, 0), (r, 0), (r, m * 0.95), (r * 0.5, m * 0.95)]]
    d["H"] = [[(0, -200), (0, t + 200)], [(r, -200), (r, t + 200)], [(0, m), (r, m)]]
    d["I"] = [[(0, -200), (0, t + 200)]]
    d["J"] = [[(r, t + 200), (r, k), (r - k, 0), (k, 0), (0, k), (0, m * 0.6)]]
    d["K"] = [[(0, -200), (0, t + 200)], [(0, m), (m * 0.25, m), (r + 40, t + 40)], [(m * 0.25, m), (r + 40, -40)]]
    d["L"] = [[(0, t + 200), (0, 0), (r + 200, 0)]]
    d["M"] = [[(0, -200), (0, t), (r / 2, t * 0.42), (r, t), (r, -200)]]
    d["N"] = [[(0, -200), (0, t), (r, 0), (r, t + 200)]]
    d["O"] = [[(k, 0), (0, k), (0, t - k), (k, t), (r - k, t), (r, t - k), (r, k), (r - k, 0), (k, 0)]]
    d["P"] = [[(0, -200), (0, t), (r - k, t), (r, t - k), (r, m * 0.9 + k * 0.7), (r - k * 0.7, m * 0.9), (0, m * 0.9)]]
    d["Q"] = [[(k, 0), (0, k), (0, t - k), (k, t), (r - k, t), (r, t - k), (r, k), (r - k, 0), (k, 0)],
              [(r * 0.55, k * 0.9), (r + 80, -80)]]
    d["R"] = [[(0, -200), (0, t), (r - k, t), (r, t - k), (r, m * 0.9 + k * 0.7), (r - k * 0.7, m * 0.9), (0, m * 0.9)],
              [(r * 0.4, m * 0.9), (r, 0), (r, -200)]]
    d["S"] = [[(r + 200, t), (k, t), (0, t - k), (0, m + k * 0.45), (k * 0.45, m), (r - k * 0.45, m),
               (r, m - k * 0.45), (r, k), (r - k, 0), (-200, 0)]]
    d["T"] = [[(-200, t), (r + 200, t)], [(r / 2, t), (r / 2, -200)]]
    d["U"] = [[(0, t + 200), (0, k), (k, 0), (r - k, 0), (r, k), (r, t + 200)]]
    d["V"] = [[(-20, t + 300), (0, t), (r / 2, 0), (r, t), (r + 20, t + 300)]]
    d["W"] = [[(0, t + 200), (0, 0), (r / 2, t * 0.55), (r, 0), (r, t + 200)]]
    d["X"] = [[(0, t + 200), (0, t), (r, 0), (r, -200)], [(r, t + 200), (r, t), (0, 0), (0, -200)]]
    d["Y"] = [[(0, t + 200), (0, t), (r / 2, m), (r, t), (r, t + 200)], [(r / 2, m), (r / 2, -200)]]
    d["Z"] = [[(-200, t), (r, t), (r, t - 20), (0, 20), (0, 0), (r + 200, 0)]]

    # Chiffres
    d["0"] = [d["O"][0], [(r * 0.28, t * 0.3), (r * 0.72, t * 0.7)]]
    d["1"] = [[(r * 0.15, t - k * 0.8), (r * 0.55, t), (r * 0.55, -200)]]
    d["2"] = [[(0, t - k), (k, t), (r - k, t), (r, t - k), (r, m + k * 0.5), (0, k * 0.4), (0, 0), (r + 200, 0)]]
    d["3"] = [[(-200, t), (r - k, t), (r, t - k), (r, m + k * 0.6), (r - k * 0.6, m), (r * 0.35, m)],
              [(r - k * 0.6, m), (r, m - k * 0.6), (r, k), (r - k, 0), (-200, 0)]]
    d["4"] = [[(r * 0.75, -200), (r * 0.75, t), (0, t * 0.32), (0, t * 0.3), (r + 200, t * 0.3)]]
    d["5"] = [[(r + 200, t), (0, t), (0, m + k * 0.2), (r - k, m + k * 0.2), (r, m + k * 0.2 - k), (r, k), (r - k, 0), (-200, 0)]]
    d["6"] = [[(r - k * 0.3, t), (k, t), (0, t - k), (0, k), (k, 0), (r - k, 0), (r, k), (r, m - k * 0.2),
               (r - k, m + k * 0.8), (0, m + k * 0.8)]]
    d["7"] = [[(-200, t), (r, t), (r, t - k * 0.6), (r * 0.3, -200)]]
    d["8"] = [[(k * 0.8, m), (k * 0.2, m + k * 0.6), (k * 0.2, t - k * 0.8), (k, t), (r - k, t), (r - k * 0.2, t - k * 0.8),
               (r - k * 0.2, m + k * 0.6), (r - k * 0.8, m), (k * 0.8, m), (0, m - k * 0.8), (0, k), (k, 0), (r - k, 0),
               (r, k), (r, m - k * 0.8), (r - k * 0.8, m)]]
    d["9"] = [[(k * 0.3, 0), (r - k, 0), (r, k), (r, t - k), (r - k, t), (k, t), (0, t - k), (0, m + k * 0.2),
               (k, m - k * 0.8), (r, m - k * 0.8)]]
    return d


def build_glyph(name, t, r):
    """Renvoie (géométrie, largeur extérieure) d'une lettre/chiffre à la taille demandée."""
    paths = G(t - S, r, K * t / CAP)[name]
    geom = stroke(paths, S)
    geom = affinity.translate(geom, S / 2, S / 2)
    width = r + S
    return finish(geom, width, t), width


WIDTHS = {  # largeur des lignes centrales par lettre
    "A": 400, "B": 390, "C": 360, "D": 400, "E": 330, "F": 330, "G": 400, "H": 400, "I": 0, "J": 360,
    "K": 400, "L": 320, "M": 500, "N": 400, "O": 410, "P": 380, "Q": 410, "R": 390, "S": 380, "T": 400,
    "U": 400, "V": 420, "W": 520, "X": 420, "Y": 420, "Z": 380,
    "0": 380, "1": 300, "2": 370, "3": 360, "4": 390, "5": 360, "6": 370, "7": 350, "8": 380, "9": 370,
}


# ── Signes et accents (dessinés directement en coordonnées absolues) ───────────

def rect(x0, y0, x1, y1):
    return box(x0, y0, x1, y1)


def punct():
    p = {}
    sq = S + 10
    p["."] = (rect(0, 0, sq, sq), sq)
    p[","] = (unary_union([rect(0, 0, sq, sq), Polygon([(sq * 0.25, 0), (sq, 0), (sq * 0.25, -150)])]), sq)
    p[":"] = (unary_union([rect(0, 0, sq, sq), rect(0, 360, sq, 360 + sq)]), sq)
    p[";"] = (unary_union([p[","][0], rect(0, 360, sq, 360 + sq)]), sq)
    p["!"] = (unary_union([rect(0, 0, sq, sq), Polygon([(0, CAP), (sq, CAP), (sq - 20, 240), (20, 240)])]), sq)
    q = stroke([[(0, CAP - 140), (110, CAP - 75), (250, CAP - 75), (330, CAP - 140), (330, 470), (175, 360), (175, 250)]], S)
    p["?"] = (unary_union([affinity.translate(q, S / 2, 0), rect(175 + S / 2 - sq / 2, 0, 175 + S / 2 + sq / 2, sq)])
              .intersection(box(0, 0, 330 + S, CAP)), 330 + S)
    p["'"] = (Polygon([(0, CAP), (sq, CAP), (sq - 25, CAP - 230), (25, CAP - 230)]), sq)
    p["’"] = p["'"]
    p['"'] = (unary_union([p["'"][0], affinity.translate(p["'"][0], sq + 70, 0)]), sq * 2 + 70)
    p["-"] = (rect(0, 280, 300, 280 + S - 10), 300)
    p["–"] = (rect(0, 280, 460, 280 + S - 10), 460)
    p["—"] = (rect(0, 280, 700, 280 + S - 10), 700)
    p["_"] = (rect(0, -60, 500, -60 + S - 20), 500)
    p["+"] = (unary_union([rect(0, 285, 420, 285 + S - 20), rect(210 - (S - 20) / 2, 140, 210 + (S - 20) / 2, 560)]), 420)
    p["="] = (unary_union([rect(0, 180, 400, 180 + S - 30), rect(0, 400, 400, 400 + S - 30)]), 400)
    x = stroke([[(0, 130), (330, 460)], [(0, 460), (330, 130)]], S - 20).intersection(box(0, 110, 330, 480))
    p["×"] = (x, 330)
    p["/"] = (stroke([[(0, -60), (360, CAP + 60)]], S).intersection(box(0, -60, 360, CAP + 60)), 360)
    p["("] = (stroke([[(220, CAP + 60), (60, CAP - 120), (60, 60), (220, -120)]], S).intersection(box(0, -120, 260, CAP + 60)), 260)
    p[")"] = (affinity.scale(p["("][0], xfact=-1, origin=(130, 0)), 260)
    p["<"] = (stroke([[(380, 590), (60, 350), (380, 110)]], S - 10).intersection(box(0, 0, 400, CAP)), 400)
    p[">"] = (affinity.scale(p["<"][0], xfact=-1, origin=(200, 0)), 400)
    c = stroke([[(140, 150), (440, 550)]], S - 10).intersection(box(80, 60, 500, 640))
    p["%"] = (unary_union([c, rect(0, 430, 200, 640), rect(380, 60, 580, 270)]).difference(
        unary_union([rect(70, 500, 130, 570), rect(450, 130, 510, 200)])), 580)
    p["#"] = (unary_union([rect(120, 40, 120 + S - 30, 660), rect(330, 40, 330 + S - 30, 660),
                           rect(0, 200, 570, 200 + S - 30), rect(0, 410, 570, 410 + S - 30)]), 570)
    p["*"] = (unary_union([rect(170, 380, 270, 700),
                           affinity.rotate(rect(170, 380, 270, 700), 60, origin=(220, 540)),
                           affinity.rotate(rect(170, 380, 270, 700), -60, origin=(220, 540))])
              .intersection(box(40, 360, 400, 720)), 440)
    # Symboles monétaires : C / S + barres
    cg, cw = build_glyph("C", CAP, 380)
    p["€"] = (unary_union([affinity.translate(cg, 90, 0), rect(0, 225, 360, 225 + 90), rect(0, 385, 360, 385 + 90)]), cw + 90)
    sg, sw = build_glyph("S", CAP, 360)
    p["$"] = (unary_union([sg, rect(sw / 2 - 40, -90, sw / 2 + 40, CAP + 90)]), sw)
    # « & » : pas de glyphe, la police de secours (Rubik) prend le relais
    return p


def accent(kind, cx, top):
    """Renvoie la forme d'accent centrée en cx, posée au-dessus de `top`."""
    a = 100   # épaisseur des accents
    y0 = top + 50
    if kind == "acute":
        return Polygon([(cx - 90, y0), (cx - 90 + a, y0), (cx + 120, y0 + 170), (cx + 120 - a * 1.1, y0 + 170)])
    if kind == "grave":
        return affinity.scale(accent("acute", cx, top), xfact=-1, origin=(cx, 0))
    if kind == "circ":
        return stroke([[(cx - 150, y0), (cx, y0 + 120), (cx + 150, y0)]], a).intersection(box(cx - 200, y0, cx + 200, y0 + 220))
    if kind == "dier":
        return unary_union([rect(cx - 170, y0, cx - 50, y0 + 115), rect(cx + 50, y0, cx + 170, y0 + 115)])
    if kind == "ring":
        return rect(cx - 90, y0, cx + 90, y0 + 170).difference(rect(cx - 35, y0 + 50, cx + 35, y0 + 120))
    if kind == "tilde":
        return stroke([[(cx - 160, y0 + 30), (cx - 70, y0 + 110), (cx + 70, y0 + 30), (cx + 160, y0 + 110)]], a)
    if kind == "cedil":
        return Polygon([(cx - 40, 0), (cx + 50, 0), (cx + 50, -60), (cx + 20, -170), (cx - 90, -170), (cx - 40, -70)])
    raise ValueError(kind)


ACCENTS = {"COMBINING ACUTE ACCENT": "acute", "COMBINING GRAVE ACCENT": "grave",
           "COMBINING CIRCUMFLEX ACCENT": "circ", "COMBINING DIAERESIS": "dier",
           "COMBINING RING ABOVE": "ring", "COMBINING TILDE": "tilde", "COMBINING CEDILLA": "cedil"}

ACCENTED = "ÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸàâäáãåçéèêëíìîïñóòôöõúùûüýÿ"


# ── Assemblage de la police ────────────────────────────────────────────────────

def geom_to_glyph(geom, offset_x):
    pen = TTGlyphPen(None)
    polys = [geom] if geom.geom_type == "Polygon" else [g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon"]
    for poly in polys:
        if poly.is_empty:
            continue
        rings = [(poly.exterior, True)] + [(i, False) for i in poly.interiors]
        for ring, outer in rings:
            pts = list(ring.coords)[:-1]
            # TrueType : contours extérieurs dans le sens horaire
            area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
            clockwise = area < 0
            if clockwise != outer:
                pts = pts[::-1]
            pen.moveTo((round(pts[0][0] + offset_x), round(pts[0][1])))
            for p in pts[1:]:
                pen.lineTo((round(p[0] + offset_x), round(p[1])))
            pen.closePath()
    return pen.glyph()


def main():
    glyphs = {}   # nom -> (géométrie, largeur d'avance)
    cmap = {}

    def add(name, geom, width, chars):
        glyphs[name] = (geom, width + 2 * SB)
        for ch in chars:
            cmap[ord(ch)] = name

    for ch, r in WIDTHS.items():
        g, w = build_glyph(ch, CAP, r)
        add(ch if not ch.isdigit() else f"digit{ch}", g, w, [ch])
        if ch.isalpha():
            gs, ws = build_glyph(ch, CAP * SMALL, r * 0.92)
            add(ch.lower() + ".sc", gs, ws, [ch.lower()])

    for ch, (g, w) in punct().items():
        add(f"uni{ord(ch):04X}", g, w, [ch])

    for ch in ACCENTED:
        parts = unicodedata.normalize("NFD", ch)
        base, marks = parts[0], parts[1:]
        small = ch.islower()
        t = CAP * SMALL if small else CAP
        r = WIDTHS[base.upper()] * (0.92 if small else 1)
        g, w = build_glyph(base.upper(), t, r)
        for mk in marks:
            kind = ACCENTS[unicodedata.name(mk)]
            g = unary_union([g, accent(kind, w / 2, t)])
        add(f"uni{ord(ch):04X}", g, w, [ch])

    # Ligatures œ / æ : repli sur OE / AE simples
    for ch, (a_, b_) in {"Œ": ("O", "E"), "œ": ("O", "E"), "Æ": ("A", "E"), "æ": ("A", "E")}.items():
        small = ch.islower()
        t = CAP * SMALL if small else CAP
        ga, wa = build_glyph(a_, t, WIDTHS[a_] * (0.92 if small else 1))
        gb, wb = build_glyph(b_, t, WIDTHS[b_] * (0.92 if small else 1))
        add(f"uni{ord(ch):04X}", unary_union([ga, affinity.translate(gb, wa + 40, 0)]), wa + 40 + wb, [ch])

    order = [".notdef", "space", "nbspace"] + sorted(glyphs)
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    full_cmap = dict(cmap)
    full_cmap[0x20] = "space"
    full_cmap[0xA0] = "nbspace"
    full_cmap[0x202F] = "nbspace"
    fb.setupCharacterMap(full_cmap)

    tt = {".notdef": TTGlyphPen(None).glyph(), "space": TTGlyphPen(None).glyph(), "nbspace": TTGlyphPen(None).glyph()}
    metrics = {".notdef": (500, 0), "space": (280, 0), "nbspace": (200, 0)}
    for name, (geom, adv) in glyphs.items():
        tt[name] = geom_to_glyph(geom, SB)
        metrics[name] = (round(adv), SB)
    fb.setupGlyf(tt)
    # lsb réels
    glyf = fb.font["glyf"]
    for name in metrics:
        g = glyf[name]
        g.recalcBounds(glyf)
        metrics[name] = (metrics[name][0], getattr(g, "xMin", 0) or 0)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=950, descent=-250)
    fb.setupNameTable({"familyName": "Cendrier", "styleName": "Regular",
                       "uniqueFontIdentifier": "Cendrier-Regular-1.0", "fullName": "Cendrier",
                       "psName": "Cendrier-Regular", "version": "Version 1.000",
                       "copyright": "The Ashtray King — police maison"})
    fb.setupOS2(sTypoAscender=950, sTypoDescender=-250, sTypoLineGap=0,
                usWinAscent=1000, usWinDescent=300, sxHeight=round(CAP * SMALL), sCapHeight=CAP,
                usWeightClass=900)
    fb.setupPost()

    os.makedirs(OUT_DIR, exist_ok=True)
    fb.font.flavor = "woff2"
    out = os.path.join(OUT_DIR, "cendrier.woff2")
    fb.save(out)
    print(f"{len(glyphs)} glyphes -> {out} ({os.path.getsize(out) // 1024} Ko)")


if __name__ == "__main__":
    main()
