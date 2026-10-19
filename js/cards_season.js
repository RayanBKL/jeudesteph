// Cartes EXCLUSIVES de saison : jamais dans les paquets (catégorie « saison »), données par les récompenses de fin de saison
// (supabase/migrations/022_recompenses_saison.sql). Une série de 10 cartes par saison, une par palier atteint.
(function () {
  const SEASON_ITEMS = [
  {
    "id": "saison1-megot",
    "cat": "saison",
    "rarity": "mythique",
    "name": "Le Mégot Doré (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 18,
    "clickBoost": 6,
    "value": 3000,
    "img": "assets/cards/sai_saison1-megot.webp",
    "desc": "Le tout premier mégot du Mégot III au Roi, plaqué or. On n'a jamais vu un trophée aussi collant."
  },
  {
    "id": "saison1-roulee",
    "cat": "saison",
    "rarity": "mythique",
    "name": "La Roulée de Collection (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 20,
    "clickBoost": 7,
    "value": 3600,
    "img": "assets/cards/sai_saison1-roulee.webp",
    "desc": "Roulée à la main par un parrain, pas un pli de travers. Elle ne se fume pas, elle s'expose."
  },
  {
    "id": "saison1-blonde",
    "cat": "saison",
    "rarity": "mythique",
    "name": "La Blonde Dorée (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 22,
    "clickBoost": 8,
    "value": 4200,
    "img": "assets/cards/sai_saison1-blonde.webp",
    "desc": "Blonde comme les blés et comme la bière du bar. La saison te l'a offerte."
  },
  {
    "id": "saison1-brune",
    "cat": "saison",
    "rarity": "mythique",
    "name": "La Brune Impériale (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 24,
    "clickBoost": 9,
    "value": 4800,
    "img": "assets/cards/sai_saison1-brune.webp",
    "desc": "Brune, forte, et réservée à ceux qui ont tenu jusqu'au bout du mois."
  },
  {
    "id": "saison1-cigarillo",
    "cat": "saison",
    "rarity": "mythique",
    "name": "Le Cigarillo de Gala (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 26,
    "clickBoost": 10,
    "value": 5400,
    "img": "assets/cards/sai_saison1-cigarillo.webp",
    "desc": "On l'allume pour les grandes occasions, ou pour impressionner le voisin de comptoir."
  },
  {
    "id": "saison1-havane",
    "cat": "saison",
    "rarity": "mythique",
    "name": "La Havane Sacrée (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 28,
    "clickBoost": 11,
    "value": 6000,
    "img": "assets/cards/sai_saison1-havane.webp",
    "desc": "Roulée sur la cuisse d'un artisan, bénie par le patron. Odeur de victoire."
  },
  {
    "id": "saison1-buraliste",
    "cat": "saison",
    "rarity": "mythique",
    "name": "Le Tiroir-Caisse en Or (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 30,
    "clickBoost": 12,
    "value": 6600,
    "img": "assets/cards/sai_saison1-buraliste.webp",
    "desc": "Il fait « ding » à chaque victoire. Le buraliste jure ne pas l'avoir vendu."
  },
  {
    "id": "saison1-baron",
    "cat": "saison",
    "rarity": "mythique",
    "name": "Le Cendrier du Baron (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 32,
    "clickBoost": 13,
    "value": 7200,
    "img": "assets/cards/sai_saison1-baron.webp",
    "desc": "Un cendrier en cristal, taillé pour les barons. Personne n'ose y poser une cendre."
  },
  {
    "id": "saison1-parrain",
    "cat": "saison",
    "rarity": "mythique",
    "name": "La Bague du Parrain (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 34,
    "clickBoost": 14,
    "value": 7800,
    "img": "assets/cards/sai_saison1-parrain.webp",
    "desc": "Tu la portes, on te respecte. Tu la retires, on te cherche des noises."
  },
  {
    "id": "saison1-roi",
    "cat": "saison",
    "rarity": "mythique",
    "name": "La Couronne du Roi du Comptoir (Saison 1)",
    "emoji": "🏆",
    "cashPerSec": 36,
    "clickBoost": 15,
    "value": 8400,
    "img": "assets/cards/sai_saison1-roi.webp",
    "desc": "La seule couronne qui sent la fumée. Réservée au sommet de la saison."
  }
];
  const target = (typeof window !== 'undefined' ? window : globalThis);
  target.EMPIRE_EXTRA_ITEMS = (target.EMPIRE_EXTRA_ITEMS || []).concat(SEASON_ITEMS);
  if (typeof globalThis !== 'undefined') globalThis.EMPIRE_EXTRA_ITEMS = target.EMPIRE_EXTRA_ITEMS;
})();
