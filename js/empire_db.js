// ============================================================
// THE ASHTRAY KING — Empire Collectibles Database
// 6 Catégories Complètes · Vraies Photos & Formules Chimiques Wikipédia
// Clopes · Briquets · Alcools · Drogues · Actrices VIP · Reliques Beauf
// ============================================================

const EMPIRE_RARITIES = {
  commune:    { name: 'Commune',    color: '#94a3b8', glow: 'rgba(148,163,184,0.3)', cashPerSec: 0.05, clickBoost: 0.1,  valueBase: 25,    dropWeight: 720 },
  'peu-commune': { name: 'Peu Commune', color: '#22c55e', glow: 'rgba(34,197,94,0.4)',  cashPerSec: 0.2,  clickBoost: 0.3,  valueBase: 100,   dropWeight: 210 },
  rare:       { name: 'Rare',       color: '#3b82f6', glow: 'rgba(59,130,246,0.5)',  cashPerSec: 0.8,  clickBoost: 0.8,  valueBase: 500,   dropWeight: 60  },
  epique:     { name: 'Épique',     color: '#a855f7', glow: 'rgba(168,85,247,0.7)',  cashPerSec: 3.0,  clickBoost: 2.0,  valueBase: 2500,  dropWeight: 9.5 },
  legendaire: { name: 'Légendaire', color: '#f59e0b', glow: 'rgba(245,158,11,0.85)', cashPerSec: 12.0, clickBoost: 6.0,  valueBase: 15000, dropWeight: 0.49 },
  mythique:   { name: 'Mythique',   color: '#ef4444', glow: 'rgba(239,68,68,0.95)', cashPerSec: 50.0, clickBoost: 20.0, valueBase: 100000, dropWeight: 0.01 },
};

// Pack types for the Empire store - Équilibrage professionnel
const EMPIRE_PACKS = {
  gratuit: {
    id: 'gratuit', name: '🎁 Paquet Cadeau Surprise', price: 0,
    description: "Mélange de TOUTES les catégories du marché noir. Offert par la maison toutes les 20 minutes.",
    gradient: 'linear-gradient(135deg,#1e1b4b,#3b0764)',
    categories: ['cigarette', 'briquet', 'alcool', 'drogue', 'actrice', 'beauf', 'foot', 'refs', 'chanteur', 'culte'],
    odds: { commune: 0.65, 'peu-commune': 0.25, rare: 0.085, epique: 0.013, legendaire: 0.0019, mythique: 0.0001 },
    pityThreshold: 25, pityRarity: 'rare', count: 4,
  },
  tabac: {
    id: 'tabac', name: '🚬 Tabac & Accessoires', price: 1300,
    description: "Clopes de prestige, briquets, feuilles à rouler OCB/Raw, filtres et cendriers de collection.",
    gradient: 'linear-gradient(135deg,#1a0505,#5c1a0a)',
    categories: ['cigarette', 'briquet'],
    odds: { commune: 0.75, 'peu-commune': 0.20, rare: 0.045, epique: 0.0048, legendaire: 0.00019, mythique: 0.00001 },
    pityThreshold: 40, pityRarity: 'rare', count: 5,
  },
  beauf: {
    id: 'beauf', name: '🩴 Reliques & Terroirs', price: 1800,
    description: "Gastronomie de terroir, saucissons d'Auvergne, fromages AOP, couteaux et pépites cultes du bistrot.",
    gradient: 'linear-gradient(135deg,#1a1505,#3a2a05)',
    categories: ['beauf'],
    odds: { commune: 0.70, 'peu-commune': 0.22, rare: 0.068, epique: 0.0085, legendaire: 0.00048, mythique: 0.00002 },
    pityThreshold: 35, pityRarity: 'rare', count: 5,
  },
  alcool: {
    id: 'alcool', name: '🥤 Buvette & Cave du Monde', price: 5000,
    description: "Grands crus, bières du monde, et softs cultes légendaires (Coca-Cola, Fanta, Red Bull, Orangina...).",
    gradient: 'linear-gradient(135deg,#1a0f05,#4a2a05)',
    categories: ['alcool'],
    odds: { commune: 0.55, 'peu-commune': 0.30, rare: 0.12, epique: 0.026, legendaire: 0.0038, mythique: 0.0002 },
    pityThreshold: 30, pityRarity: 'epique', count: 5,
  },
  pochon: {
    id: 'pochon', name: '🌿 Le Pochon Noir', price: 5500,
    description: "Substances pures, alcaloïdes sacrés, cristaux et formules chimiques rares de synthèse.",
    gradient: 'linear-gradient(135deg,#0a1a05,#1a4a0a)',
    categories: ['drogue'],
    odds: { commune: 0.48, 'peu-commune': 0.34, rare: 0.14, epique: 0.034, legendaire: 0.0038, mythique: 0.0002 },
    pityThreshold: 30, pityRarity: 'epique', count: 5,
  },
  backstage: {
    id: 'backstage', name: '👠 Pass Backstage VIP', price: 7500,
    description: "Les icônes VIP internationales du cinéma pour adultes. Rareté suprême et multiplicateurs colossaux.",
    gradient: 'linear-gradient(135deg,#1a0020,#5c0060)',
    categories: ['actrice'],
    odds: { commune: 0.30, 'peu-commune': 0.42, rare: 0.21, epique: 0.058, legendaire: 0.009, mythique: 0.001 },
    pityThreshold: 35, pityRarity: 'epique', count: 4,
  },
  foot: {
    id: 'foot', name: '⚽ Album du Ballon d\'Or', price: 5200,
    description: "Plus de 1 000 footballeurs, des héros du dimanche aux légendes du Ballon d'Or. Messi et Pelé sont dedans… quelque part.",
    gradient: 'linear-gradient(135deg,#0b3315,#2e9e44)',
    categories: ['foot'],
    odds: { commune: 0.52, 'peu-commune': 0.32, rare: 0.12, epique: 0.032, legendaire: 0.0075, mythique: 0.0005 },
    pityThreshold: 30, pityRarity: 'epique', count: 5,
  },
  refs: {
    id: 'refs', name: '📱 Les Mèmes du Comptoir', price: 6000,
    description: "« T'es sûrement pas français », le 6-7, Skibidi, le brainrot italien et toutes les phrases cultes d'Internet.",
    gradient: 'linear-gradient(135deg,#0f1844,#3d8bfd)',
    categories: ['refs'],
    odds: { commune: 0.50, 'peu-commune': 0.30, rare: 0.14, epique: 0.048, legendaire: 0.011, mythique: 0.001 },
    pityThreshold: 25, pityRarity: 'epique', count: 4,
  },
  musique: {
    id: 'musique', name: '🎤 Disque de Platine', price: 6000,
    description: "Rappeurs, chanteurs et légendes de la variété. Surtout du français, de Johnny à Jul, et les stars du monde entier.",
    gradient: 'linear-gradient(135deg,#2a0f44,#a35cf0)',
    categories: ['chanteur'],
    odds: { commune: 0.52, 'peu-commune': 0.31, rare: 0.12, epique: 0.04, legendaire: 0.0095, mythique: 0.0005 },
    pityThreshold: 30, pityRarity: 'epique', count: 5,
  },
  culte: {
    id: 'culte', name: '🎬 La Vidéothèque Culte', price: 5500,
    description: "Films cultes, émissions de télé, humoristes, YouTubeurs, jeux vidéo et monuments. Toute la culture du canapé.",
    gradient: 'linear-gradient(135deg,#3a0b08,#e2322b)',
    categories: ['culte'],
    odds: { commune: 0.50, 'peu-commune': 0.30, rare: 0.14, epique: 0.048, legendaire: 0.011, mythique: 0.001 },
    pityThreshold: 25, pityRarity: 'epique', count: 4,
  },
  valise: {
    id: 'valise', name: '💼 Valise Diplomatique', price: 20000,
    description: "Le sommet de l'Empire. Toutes catégories réunies. Le Graal convoité par les plus grands parrains.",
    gradient: 'linear-gradient(135deg,#0a0a1a,#1a1a5c)',
    categories: ['cigarette', 'briquet', 'alcool', 'drogue', 'actrice', 'beauf', 'foot', 'refs', 'chanteur', 'culte'],
    odds: { commune: 0.28, 'peu-commune': 0.36, rare: 0.24, epique: 0.088, legendaire: 0.021, mythique: 0.003 },
    pityThreshold: 40, pityRarity: 'legendaire', count: 6,
  },
};

// ── Prix et variantes des paquets ──
// Tous les paquets de catégorie coûtent le même prix de base et donnent 5 cartes (le paquet gratuit en donne 4).
// Chaque catégorie existe en 3 niveaux : Classique, Doré (plus de rares) et Diamant (beaucoup plus de rares, bien plus cher).
// Les prix ci-dessous sont les prix d'origine : js/balance.js les multiplie (PRICE_MULT).
const PACK_BASE_PRICE = 3000;
const PACK_RARITY_ORDER = ['commune', 'peu-commune', 'rare', 'epique', 'legendaire', 'mythique'];
const PACK_TIERS = [
  { suffix: '_or',      label: 'Doré',    priceMult: 4,  boost: 1.5, pityThreshold: 15, pityRarity: 'epique',    xpMult: 2 },
  { suffix: '_diamant', label: 'Diamant', priceMult: 15, boost: 2.2, pityThreshold: 8,  pityRarity: 'legendaire', xpMult: 4 },
];

function boostPackOdds(odds, b) {
  const w = PACK_RARITY_ORDER.map((r, i) => (odds[r] || 0) * Math.pow(b, i));
  const sum = w.reduce((a, x) => a + x, 0);
  const out = {};
  PACK_RARITY_ORDER.forEach((r, i) => { out[r] = w[i] / sum; });
  return out;
}

(function buildPackTiers() {
  ['tabac', 'beauf', 'alcool', 'pochon', 'backstage', 'foot', 'refs', 'musique', 'culte'].forEach(id => {
    const base = EMPIRE_PACKS[id];
    base.price = PACK_BASE_PRICE; base.count = 5; base.tier = 0; base.tierLabel = 'Classique'; base.xpPrice = PACK_BASE_PRICE; base.variants = [id];
    PACK_TIERS.forEach(t => {
      const vid = id + t.suffix;
      EMPIRE_PACKS[vid] = {
        ...base, id: vid, artId: id, tier: PACK_TIERS.indexOf(t) + 1, tierLabel: t.label, price: PACK_BASE_PRICE * t.priceMult, xpPrice: PACK_BASE_PRICE * t.xpMult,
        odds: boostPackOdds(base.odds, t.boost), pityThreshold: t.pityThreshold, pityRarity: t.pityRarity, count: 5, variants: null,
      };
      base.variants.push(vid);
    });
  });
  EMPIRE_PACKS.valise.count = 5;
})();

// ============================================================
// EMPIRE ITEMS DATABASE (Cartes avec vraies photos et formules)
// ============================================================

const EMPIRE_DB = [
  {
    "id": "marlboro-rouge",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Marlboro Rouge",
    "emoji": "🚬",
    "cashPerSec": 0.1,
    "clickBoost": 0.15,
    "value": 40,
    "img": "assets/cards/cig_marlboro-rouge.webp",
    "desc": "Née à Richmond en Virginie et forgée dans le grand blend américain. Feuilles sélectionnées de Virginia blond doré et Burley torréfié au soleil des grandes plaines. Tirage franc et généreux, développant des volutes chaudes aux notes de noisette grillée et de bois sec."
  },
  {
    "id": "marlboro-gold",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Marlboro Gold",
    "emoji": "🚬",
    "cashPerSec": 0.1,
    "clickBoost": 0.15,
    "value": 38,
    "img": "assets/cards/cig_marlboro-gold.webp",
    "desc": "Née à Richmond en Virginie et forgée dans le grand blend américain. Feuilles sélectionnées de Virginia blond doré et Burley torréfié au soleil des grandes plaines. Tirage franc et généreux, développant des volutes chaudes aux notes de noisette grillée et de bois sec. Variante spécifique de la manufacture Marlboro Gold."
  },
  {
    "id": "marlboro-ice-blast",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Marlboro Ice Blast",
    "emoji": "🚬",
    "cashPerSec": 0.39,
    "clickBoost": 0.44,
    "value": 215,
    "img": "assets/cards/cig_marlboro-ice-blast.webp",
    "desc": "Née à Richmond en Virginie et forgée dans le grand blend américain. Feuilles sélectionnées de Virginia blond doré et Burley torréfié au soleil des grandes plaines. Tirage franc et généreux, développant des volutes chaudes aux notes de noisette grillée et de bois sec. Appréciée des connaisseurs pour sa finesse remarquable."
  },
  {
    "id": "camel-filtre",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Camel Filtre",
    "emoji": "🚬",
    "cashPerSec": 0.11,
    "clickBoost": 0.16,
    "value": 41,
    "img": "assets/cig_camel.jpg",
    "desc": "Créée en 1913 en Caroline du Nord par R.J. Reynolds avec son emblématique dromadaire 'Old Joe'. Alliance historique de tabacs turcs d'Orient parfumés et de doux Virginia américain séché à l'air chaud. Fumée suave et veloutée, libérant une douceur aromatique subtilement miellée et épicée."
  },
  {
    "id": "camel-blue",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Camel Blue",
    "emoji": "🚬",
    "cashPerSec": 0.07,
    "clickBoost": 0.11,
    "value": 30,
    "img": "assets/cig_camel.jpg",
    "desc": "Créée en 1913 en Caroline du Nord par R.J. Reynolds avec son emblématique dromadaire 'Old Joe'. Alliance historique de tabacs turcs d'Orient parfumés et de doux Virginia américain séché à l'air chaud. Fumée suave et veloutée, libérant une douceur aromatique subtilement miellée et épicée. Variante spécifique de la manufacture Camel Blue."
  },
  {
    "id": "lucky-strike-red",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Lucky Strike Original",
    "emoji": "🚬",
    "cashPerSec": 0.41,
    "clickBoost": 0.46,
    "value": 226,
    "img": "assets/cig_lucky.jpg",
    "desc": "Fondée à Richmond dès 1871 et immortalisée par le Débarquement de 1944. Élaborée selon le procédé exclusif 'It's Toasted' sublimant le tabac par grillage au feu de bois. Arômes puissants de pain toasté et de caramel boisé, avec un hit franc en gorge et une cendre immaculée. Appréciée des connaisseurs pour sa finesse remarquable."
  },
  {
    "id": "winston-rouge",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Winston Rouge Classic",
    "emoji": "🚬",
    "cashPerSec": 0.06,
    "clickBoost": 0.1,
    "value": 28,
    "img": "assets/cig_winston.jpg",
    "desc": "Produite à Winston-Salem en Caroline du Nord depuis 1954, capitale historique du tabac américain. Assemblage équilibré de feuilles de Virginie mûries à point et de tabacs clairs sans additifs superflus. Combustion régulière et constante, offrant une fumée pleine aux nuances de céréales grillées."
  },
  {
    "id": "chesterfield-red",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Chesterfield Red",
    "emoji": "🚬",
    "cashPerSec": 0.06,
    "clickBoost": 0.09,
    "value": 27,
    "img": "assets/cig_chesterfield.jpg",
    "desc": "Introduite en 1873 aux États-Unis, réputée pour sa présence légendaire sur les écrans d'Hollywood. Mélange harmonieux de tabac blond mûri au soleil et de touches subtiles de tabac Maryland aromatique. Tirage doux et constant, fumée fluide aux légères touches de vanille boisée et de foin chaud."
  },
  {
    "id": "gitanes-brunes",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Gitanes Brunes",
    "emoji": "🚬",
    "cashPerSec": 0.05,
    "clickBoost": 0.09,
    "value": 26,
    "img": "assets/cig_gitanes.jpg",
    "desc": "Créée en 1910 par la manufacture de la SEITA, habillée de la silhouette gitane de Max Ponty. Authentique tabac brun caporal français, cultivé traditionnellement et affiné à point. Fumée dense et corsée, marquée par des notes rustiques de cuir, de tourbe et de fève de cacao."
  },
  {
    "id": "gitanes-papier-mais",
    "cat": "cigarette",
    "rarity": "mythique",
    "name": "Gitanes Papier Maïs",
    "emoji": "🚬",
    "cashPerSec": 61.34,
    "clickBoost": 23,
    "value": 130240,
    "img": "assets/cig_gitanes.jpg",
    "desc": "Créée en 1910 par la manufacture de la SEITA, habillée de la silhouette gitane de Max Ponty. Authentique tabac brun caporal français, cultivé traditionnellement et affiné à point. Fumée dense et corsée, marquée par des notes rustiques de cuir, de tourbe et de fève de cacao. Une pièce de collection rarissime au prestige intemporel."
  },
  {
    "id": "gauloises-bleues",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Gauloises Bleues",
    "emoji": "🚬",
    "cashPerSec": 0.08,
    "clickBoost": 0.12,
    "value": 33,
    "img": "assets/cig_gauloises.jpg",
    "desc": "Lancée en 1910 sous l'emblème gaulois au casque ailé dessiné par le graphiste Marcel Jacno. Pur tabac brun caporal d'une richesse robuste, découpé en brins courts et serrés. Caractère vigoureux et terreux, parfum boisé d'une rare intensité qui a embaumé les zincs des bistrots."
  },
  {
    "id": "philip-morris",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Philip Morris Classic",
    "emoji": "🚬",
    "cashPerSec": 0.42,
    "clickBoost": 0.47,
    "value": 231,
    "img": "assets/cig_philip_morris.jpg",
    "desc": "Cigarette emblématique du terroir buraliste français. Feuilles de tabac sélectionnées et affinées selon les méthodes traditionnelles, munie d'un filtre assurant une combustion douce et équilibrée. Offre une fumée aromatique harmonieuse aux nuances de bois sec et de foin toasté."
  },
  {
    "id": "dunhill-rouge",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Dunhill International",
    "emoji": "🚬",
    "cashPerSec": 0.38,
    "clickBoost": 0.43,
    "value": 208,
    "img": "assets/cig_dunhill.jpg",
    "desc": "Maison de prestige fondée sur Duke Street à Londres en 1907 par Alfred Dunhill. Feuilles de Virginie dorées de récolte supérieure, vieillies avec soin en caves climatisées. Fumée d'une exceptionnelle rondeur, caressante en bouche avec des arômes de cèdre et d'épices douces. Appréciée des connaisseurs pour sa finesse remarquable."
  },
  {
    "id": "davidoff-classic",
    "cat": "cigarette",
    "rarity": "mythique",
    "name": "Davidoff Classic",
    "emoji": "🚬",
    "cashPerSec": 56.36,
    "clickBoost": 21.7,
    "value": 116960,
    "img": "assets/cig_davidoff.jpg",
    "desc": "Fondée par l'illustre maître du tabac Zino Davidoff, symbole du luxe et de l'exigence suisse. Sélection rigoureuse des meilleurs crus mondiaux, triés feuille par feuille à la main. Fumée soyeuse et aristocratique, équilibrant parfaitement douceur crémeuse et notes de bois précieux. Une pièce de collection rarissime au prestige intemporel."
  },
  {
    "id": "sobranie-black",
    "cat": "cigarette",
    "rarity": "mythique",
    "name": "Sobranie Black Russian",
    "emoji": "🚬",
    "cashPerSec": 54.3,
    "clickBoost": 21.1,
    "value": 111480,
    "img": "assets/cig_sobranie.jpg",
    "desc": "Fournisseur officiel des cours impériales de Grande-Bretagne et de Russie depuis 1879. Tabac oriental d'exception et Virginia d'or emballés dans un papier d'orfèvre au filtre doré 24 carats. Bouffées nobles et parfumées dégageant une élégance olfactive de résine précieuse et de thé noir. Une pièce de collection rarissime au prestige intemporel."
  },
  {
    "id": "sobranie-cocktail",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Sobranie Cocktail",
    "emoji": "🚬",
    "cashPerSec": 0.26,
    "clickBoost": 0.31,
    "value": 138,
    "img": "assets/cig_sobranie.jpg",
    "desc": "Fournisseur officiel des cours impériales de Grande-Bretagne et de Russie depuis 1879. Tabac oriental d'exception et Virginia d'or emballés dans un papier d'orfèvre au filtre doré 24 carats. Bouffées nobles et parfumées dégageant une élégance olfactive de résine précieuse et de thé noir. Une pièce de collection rarissime au prestige intemporel. Variante spécifique de la manufacture Sobranie Cocktail."
  },
  {
    "id": "american-spirit",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "American Spirit Blue",
    "emoji": "🚬",
    "cashPerSec": 0.07,
    "clickBoost": 0.1,
    "value": 30,
    "img": "assets/cig_spirit.jpg",
    "desc": "Fondée à Santa Fe au Nouveau-Mexique dans le respect des traditions de culture amérindiennes. 100% feuilles entières cultivées de manière éco-responsable sans aucun additif chimique. Tassement ultra-dense assurant une combustion deux fois plus longue, pureté végétale cristalline."
  },
  {
    "id": "newport-menthol",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Newport Menthol 100s",
    "emoji": "🚬",
    "cashPerSec": 0.33,
    "clickBoost": 0.38,
    "value": 175,
    "img": "assets/cig_newport.jpg",
    "desc": "Créée dans les années 1950 et devenue le titan incontesté de la culture East Coast américaine. Tabac blond corsé délicatement infusé aux huiles de menthol naturelles de première pression. Frisson glacial vivifiant dès le premier tirage, suivi d'une rondeur chaleureuse et persistante. Appréciée des connaisseurs pour sa finesse remarquable."
  },
  {
    "id": "cohiba-siglo-vi",
    "cat": "cigarette",
    "rarity": "mythique",
    "name": "Cohiba Siglo VI Gran Reserva",
    "emoji": "🚬",
    "cashPerSec": 59.44,
    "clickBoost": 22.5,
    "value": 125160,
    "img": "assets/cig_cohiba.jpg",
    "desc": "Manufacture secrète El Laguito à La Havane, cigare originellement réservé à la diplomatie cubaine. Feuilles d'exception de la vallée de Vuelta Abajo bénéficiant d'une troisième fermentation en fûts de cèdre. Complexité aromatique monumentale mêlant cacao amer, cuir patiné, cèdre et poivre blanc. Une pièce de collection rarissime au prestige intemporel."
  },
  {
    "id": "montecristo-no4",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Montecristo N°4",
    "emoji": "🚬",
    "cashPerSec": 0.25,
    "clickBoost": 0.3,
    "value": 128,
    "img": "assets/cig_montecristo.png",
    "desc": "Fondé en 1935 à Cuba en hommage au roman favori lu aux artisans rouleurs de cigares. Cape maduro grasse et soyeuse enveloppant une tripe longue aux arômes terreux profonds. Tirage parfait délivrant des notes torréfiées de café expresso, noisette grillée et bois d'acajou. Une pièce de collection rarissime au prestige intemporel."
  },
  {
    "id": "romeo-julieta",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Romeo y Julieta Churchill",
    "emoji": "🚬",
    "cashPerSec": 0.39,
    "clickBoost": 0.44,
    "value": 213,
    "img": "assets/cig_romeo.png",
    "desc": "Maison havanaise de 1875 rendue immortelle par Winston Churchill qui en fit sa signature. Sélection d'arômes de corps moyen équilibrée par des feuilles de liage d'une élasticité parfaite. Saveurs délicates de fleurs séchées, amande douce et cèdre avec une finale fraîche et persistante. Appréciée des connaisseurs pour sa finesse remarquable."
  },
  {
    "id": "arturo-fuente",
    "cat": "cigarette",
    "rarity": "mythique",
    "name": "Arturo Fuente Opus X",
    "emoji": "🚬",
    "cashPerSec": 64.06,
    "clickBoost": 23.7,
    "value": 137480,
    "img": "assets/cig_arturo_fuente.jpg",
    "desc": "Cigarette emblématique du terroir buraliste français. Feuilles de tabac sélectionnées et affinées selon les méthodes traditionnelles, munie d'un filtre assurant une combustion douce et équilibrée. Offre une fumée aromatique harmonieuse aux nuances de bois sec et de foin toasté. Variante spécifique de la manufacture Arturo Fuente Opus X."
  },
  {
    "id": "parliament-super",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Parliament Recessed Filter",
    "emoji": "🚬",
    "cashPerSec": 0.39,
    "clickBoost": 0.44,
    "value": 217,
    "img": "assets/cig_parliament.jpg",
    "desc": "Créée à New York en 1931, célèbre pour son embout encastré 'Recessed Filter' breveté. Feuilles de Virginie douces et claires soigneusement aérées pour minimiser toute âcreté. Tirage particulièrement doux et aérien évitant le contact direct du filtre avec les lèvres. Appréciée des connaisseurs pour sa finesse remarquable."
  },
  {
    "id": "kool-green",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Kool Filter Kings",
    "emoji": "🚬",
    "cashPerSec": 0.09,
    "clickBoost": 0.13,
    "value": 35,
    "img": "assets/cig_kool.png",
    "desc": "Lancée en 1933 avec son manchot mascotte 'Willie', première grande cigarette mentholée au monde. Tabac blond corsé sublimé par une infusion généreuse de menthol revigorant. Sensation vivifiante et glaciale en gorge, balancée par la chaleur naturelle d'un blend consistant."
  },
  {
    "id": "benson-hedges",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Benson & Hedges Gold",
    "emoji": "🚬",
    "cashPerSec": 0.12,
    "clickBoost": 0.18,
    "value": 44,
    "img": "assets/cig_benson.jpg",
    "desc": "Fondée en 1873 sur la prestigieuse Bond Street à Londres pour approvisionner le Prince de Galles. Virginia d'or pur de récolte sélectionnée, roulé dans un papier vergé de haute tenue. Arômes nobles de miel ambré et de céréales chaudes, équilibre parfait entre richesse et douceur."
  },
  {
    "id": "jps-black",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "John Player Special F1",
    "emoji": "🚬",
    "cashPerSec": 0.44,
    "clickBoost": 0.49,
    "value": 245,
    "img": "assets/cig_jps.jpg",
    "desc": "Cigarette emblématique du terroir buraliste français. Feuilles de tabac sélectionnées et affinées selon les méthodes traditionnelles, munie d'un filtre assurant une combustion douce et équilibrée. Offre une fumée aromatique harmonieuse aux nuances de bois sec et de foin toasté. Variante spécifique de la manufacture John Player Special F1."
  },
  {
    "id": "kent-blue",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Kent Core Blue",
    "emoji": "🚬",
    "cashPerSec": 0.09,
    "clickBoost": 0.14,
    "value": 37,
    "img": "assets/cig_kent.jpg",
    "desc": "Introduite en 1952 par Lorillard, pionnière technologique des filtres Micronite haute rétention. Tabacs clairs désaérés pour une pureté optimale et une combustion ultra-régulière. Grande douceur en gorge, goût neutre et élégant laissant s'exprimer la finesse du tabac blond."
  },
  {
    "id": "pall-mall-red",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Pall Mall Red",
    "emoji": "🚬",
    "cashPerSec": 0.05,
    "clickBoost": 0.08,
    "value": 25,
    "img": "assets/cig_pallmall.jpg",
    "desc": "Créée en 1899 à New York, précurseur historique du format 'King Size' moderne. Mélange traditionnel de tabacs américains séchés au soleil et de touches de Burley toasté. Fumée équilibrée et généreuse, offrant une satisfaction constante du premier au dernier centimètre."
  },
  {
    "id": "rothmans-king",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Rothmans King Size",
    "emoji": "🚬",
    "cashPerSec": 0.11,
    "clickBoost": 0.16,
    "value": 41,
    "img": "assets/cig_rothmans.jpg",
    "desc": "Maison londonienne fondée en 1890 sur Fleet Street, réputée pour ses cigarettes King Size de luxe. Tabacs de Virginie dorés triés à la main, assemblés avec une régularité britannique exemplaire. Rondeur veloutée en bouche, notes discrètes de cèdre et de pain chaud avec un filtre blanc immaculé."
  },
  {
    "id": "carpati-sf",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Carpați Fără Filtru",
    "emoji": "🚬",
    "cashPerSec": 0.11,
    "clickBoost": 0.16,
    "value": 41,
    "img": "assets/cig_carpati.jpg",
    "desc": "Monument historique de la Régie autonome des tabacs de Timișoara et Sfântu Gheorghe fondé en 1931. Tabac oriental brut des Balkans, séché à l'air sec des vallées des Carpates. Fumée rustique et franche, dégageant des effluves boisés de foin sauvage et de pin résineux."
  },
  {
    "id": "snagov-lux",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Snagov Lux Filtru",
    "emoji": "🚬",
    "cashPerSec": 0.44,
    "clickBoost": 0.49,
    "value": 244,
    "img": "assets/cig_snagov.jpg",
    "desc": "Créée à Bucarest pour constituer la vitrine de prestige de l'industrie du tabac roumaine. Sélection des meilleurs tabacs orientaux et de Virginie de la plaine danubienne dans un paquet rouge et or. Fumée riche et équilibrée, associant la douceur des tabacs clairs à la persistance épicée des Balkans. Appréciée des connaisseurs pour sa finesse remarquable."
  },
  {
    "id": "mararesti-clasic",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Mărășești Clasic",
    "emoji": "🚬",
    "cashPerSec": 0.1,
    "clickBoost": 0.14,
    "value": 38,
    "img": "assets/cig_mararesti.jpg",
    "desc": "Produite dès 1917 et nommée d'après la bataille héroïque de la Première Guerre mondiale. Tabac oriental rustique sans filtre, haché gros et roulé dans un papier brut. Puissance brute en gorge, saveurs terriennes authentiques et cendre grise compacte."
  },
  {
    "id": "bucegi-filtru",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Bucegi Filtru",
    "emoji": "🚬",
    "cashPerSec": 0.09,
    "clickBoost": 0.13,
    "value": 35,
    "img": "assets/cig_bucegi.jpg",
    "desc": "Inspirée des majestueux monts Bucegi dominant le massif des Carpates centrales. Tabac oriental sélectionné pour sa richesse en huiles aromatiques naturelles. Notes boisées de mousse forestière et d'herbes séchées, combustion lente et parfum enveloppant."
  },
  {
    "id": "boyard-mais",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "Boyard Papier Maïs",
    "emoji": "🚬",
    "cashPerSec": 0.05,
    "clickBoost": 0.08,
    "value": 25,
    "img": "assets/cig_boyard.jpg",
    "desc": "Le gros module trapu des campagnes françaises façonné par la SEITA. Tabac brun corsé roulé dans un papier jaune paille à base de maïs naturel. Fumée généreuse et terrienne, goût franc de pain d'épices rustique et de tabac de garde."
  },
  {
    "id": "news-bleu",
    "cat": "cigarette",
    "rarity": "commune",
    "name": "News Bleu",
    "emoji": "🚬",
    "cashPerSec": 0.08,
    "clickBoost": 0.12,
    "value": 33,
    "img": "assets/cig_news.jpg",
    "desc": "Lancée dans les années 1990 pour incarner le tabac accessible et urbain des pauses entre amis. Mélange blond polyvalent de tabacs américains et européens à coupe fine régulière. Fumée légère et immédiate, tirage fluide idéal pour un moment de décompression sans artifice."
  },
  {
    "id": "belomorkanal-canal",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Belomorkanal Papirosi",
    "emoji": "🚬",
    "cashPerSec": 0.29,
    "clickBoost": 0.34,
    "value": 155,
    "img": "assets/cig_belomorkanal.jpg",
    "desc": "Créée en 1932 à Léningrad, reconnaissable à son tube cartonné creux et sa carte du canal Baltique-Blanc. Papirosi traditionnelles russes farcies de tabac oriental brut sans aucun filtre chimique. Tirage direct et robuste, fumée dense et rustique dégageant un parfum puissant de tabac brun séché. Appréciée des connaisseurs pour sa finesse remarquable."
  },
  {
    "id": "gudang-garam-surya",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Gudang Garam Surya",
    "emoji": "🚬",
    "cashPerSec": 0.33,
    "clickBoost": 0.38,
    "value": 178,
    "img": "assets/cig_gudang_garam.jpg",
    "desc": "Manufacture légendaire de Kediri sur l'île de Java, maîtresse du kretek indonésien depuis 1958. Mariage envoûtant de tabac local et de clous de girofle écrasés, saupoudrés d'essences aromatiques. Braise qui crépite délicieusement à chaque bouffée, saveurs sucrées, chaudes et épicées incomparables. Appréciée des connaisseurs pour sa finesse remarquable."
  },
  {
    "id": "chunghwa-soft",
    "cat": "cigarette",
    "rarity": "peu-commune",
    "name": "Chunghwa Soft Pack",
    "emoji": "🚬",
    "cashPerSec": 0.4,
    "clickBoost": 0.45,
    "value": 219,
    "img": "assets/cig_chunghwa.jpg",
    "desc": "Manufacture d'État de Shanghai, reconnaissable à la façade rouge ornée de la porte Tiananmen dorée. Feuilles de Virginie de première cueillette soigneusement affinées en fûts traditionnels. Arôme riche et raffiné de prune séchée et de miel sauvage, tirage impeccable d'une extrême douceur. Une pièce de collection rarissime au prestige intemporel."
  },
  {
    "id": "briquet-bic-maxi",
    "cat": "briquet",
    "rarity": "commune",
    "name": "BIC Maxi Jaune",
    "emoji": "🔥",
    "cashPerSec": 0.11,
    "clickBoost": 0.16,
    "value": 42,
    "img": "assets/briquet_bic.jpg",
    "desc": "Le soldat de poche universel reconnu pour sa fiabilité mécanique infaillible et sa durée de vie record de 3000 flammes. Ergonomie parfaite, sécurité enfant brevetée et présence rassurante dans toutes les vestes."
  },
  {
    "id": "briquet-clipper",
    "cat": "briquet",
    "rarity": "commune",
    "name": "Clipper Métal Classique",
    "emoji": "🔥",
    "cashPerSec": 0.08,
    "clickBoost": 0.12,
    "value": 33,
    "img": "assets/briquet_clipper.jpg",
    "desc": "Briquet espagnol culte doté d'une forme cylindrique reconnaissable, d'un tasseur amovible et d'un réservoir rechargeable. La flamme s'agrandit automatiquement à l'inclinaison pour un allumage sur-mesure."
  },
  {
    "id": "briquet-zippo-chrome",
    "cat": "briquet",
    "rarity": "rare",
    "name": "Zippo Chrome Vintage",
    "emoji": "🔥",
    "cashPerSec": 1.42,
    "clickBoost": 1.23,
    "value": 852,
    "img": "assets/briquet_zippo.jpg",
    "desc": "Le légendaire briquet tempête en laiton brossé fabriqué à Bradford en Pennsylvanie depuis 1932. Son ouverture d'un coup de pouce produit le « clic » d'acier inimitable qui résiste aux vents les plus violents."
  },
  {
    "id": "briquet-cartier",
    "cat": "briquet",
    "rarity": "rare",
    "name": "Cartier Ovale Plaqué Or",
    "emoji": "🔥",
    "cashPerSec": 1.42,
    "clickBoost": 1.24,
    "value": 854,
    "img": "assets/briquet_cartier.jpg",
    "desc": "Briquet vintage de haute élégance mécanique du milieu du XXe siècle, mécanisme à levier horizontal et finition plaqué or ou laque raffinée des grands salons fumeurs."
  },
  {
    "id": "briquet-ronson",
    "cat": "briquet",
    "rarity": "rare",
    "name": "Ronson Varaflame",
    "emoji": "🔥",
    "cashPerSec": 1.05,
    "clickBoost": 0.95,
    "value": 643,
    "img": "assets/briquet_ronson.jpg",
    "desc": "Briquet vintage de haute élégance mécanique du milieu du XXe siècle, mécanisme à levier horizontal et finition plaqué or ou laque raffinée des grands salons fumeurs. Variante spécifique de la manufacture Ronson Varaflame."
  },
  {
    "id": "briquet-dupont-or",
    "cat": "briquet",
    "rarity": "epique",
    "name": "S.T. Dupont Ligne 2 Or",
    "emoji": "🔥",
    "cashPerSec": 4.92,
    "clickBoost": 3.2,
    "value": 4418,
    "img": "assets/briquet_dupont.jpg",
    "desc": "Chef-d'œuvre de haute orfèvrerie parisienne usiné dans un bloc de métal précieux massif. Émet à l'ouverture le tintement cristallin inimitable 'cling' reconnaissable entre mille par les collectionneurs du monde entier."
  },
  {
    "id": "briquet-allumettes",
    "cat": "briquet",
    "rarity": "commune",
    "name": "Allumettes Suédoises",
    "emoji": "🔥",
    "cashPerSec": 0.1,
    "clickBoost": 0.15,
    "value": 40,
    "img": "assets/briquet_allumette.jpg",
    "desc": "Conçu pour offrir un allumage infaillible, une prise en main ergonomique et une durabilité remarquable au service des connaisseurs."
  },
  {
    "id": "briquet-zippo-laiton",
    "cat": "briquet",
    "rarity": "rare",
    "name": "Zippo Laiton Brossé",
    "emoji": "🔥",
    "cashPerSec": 1.09,
    "clickBoost": 0.98,
    "value": 664,
    "img": "https://images.unsplash.com/photo-1599839619722-39751411ea63?w=400&q=80",
    "desc": "Le légendaire briquet tempête en laiton brossé fabriqué à Bradford en Pennsylvanie depuis 1932. Son ouverture d'un coup de pouce produit le « clic » d'acier inimitable qui résiste aux vents les plus violents. Variante spécifique de la manufacture Zippo Laiton Brossé."
  },
  {
    "id": "briquet-bic-mini",
    "cat": "briquet",
    "rarity": "commune",
    "name": "BIC Mini Rouge",
    "emoji": "🔥",
    "cashPerSec": 0.06,
    "clickBoost": 0.1,
    "value": 29,
    "img": "https://images.unsplash.com/photo-1618315807954-3453b3dfa002?w=400&q=80",
    "desc": "Le soldat de poche universel reconnu pour sa fiabilité mécanique infaillible et sa durée de vie record de 3000 flammes. Ergonomie parfaite, sécurité enfant brevetée et présence rassurante dans toutes les vestes. Variante spécifique de la manufacture BIC Mini Rouge."
  },
  {
    "id": "briquet-tempete",
    "cat": "briquet",
    "rarity": "peu-commune",
    "name": "Briquet Chalumeau",
    "emoji": "🔥",
    "cashPerSec": 0.27,
    "clickBoost": 0.32,
    "value": 142,
    "img": "https://images.unsplash.com/photo-1549468057-5b7fa1a41d7a?w=400&q=80",
    "desc": "Briquet à allumage piézoélectrique projetant une flamme bleue rigide ultra-chaude à plus de 1 300°C, capable d'embraser un cigare même en pleine tempête côtière."
  },
  {
    "id": "briquet-plasma",
    "cat": "briquet",
    "rarity": "rare",
    "name": "Briquet USB Plasma",
    "emoji": "⚡",
    "cashPerSec": 1.21,
    "clickBoost": 1.07,
    "value": 732,
    "img": "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&q=80",
    "desc": "Briquet électrique sans gaz générant un double arc électrique de plasma violet par batterie rechargeable, insensible au vent et à l'humidité."
  },
  {
    "id": "ricard-51",
    "cat": "alcool",
    "rarity": "epique",
    "name": "Ricard Pastis de Marseille 1932 Culte",
    "emoji": "🥃",
    "cashPerSec": 5.12,
    "clickBoost": 3.3,
    "value": 4615,
    "img": "assets/alcool_ricard.jpg",
    "desc": "Le « vrai pastis de Marseille » inventé en 1932 par Paul Ricard. Assemblage mythique d'anis étoilé de Chine, de réglisse méditerranéenne et d'herbes aromatiques de Provence."
  },
  {
    "id": "guinness-draught",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Guinness Extra Stout",
    "emoji": "🍺",
    "cashPerSec": 1.05,
    "clickBoost": 0.95,
    "value": 643,
    "img": "assets/alcool_guinness.png",
    "desc": "Le stout irlandais légendaire de St. James's Gate à Dublin. Robe noir rubis profond, mousse crémeuse窒azote dense et saveurs grillées de café torréfié et cacao amer."
  },
  {
    "id": "corona-extra",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Corona Extra & Citron",
    "emoji": "🍺",
    "cashPerSec": 1.08,
    "clickBoost": 0.97,
    "value": 660,
    "img": "assets/alcool_corona.png",
    "desc": "La lager mexicaine blonde en bouteille transparente servie glacée avec son quart de citron vert dans le goulot. Légère, vive et synonyme de soleil tropical."
  },
  {
    "id": "jack-daniels-no7",
    "cat": "alcool",
    "rarity": "epique",
    "name": "Jack Daniel's Old No. 7 Tennessee Whiskey",
    "emoji": "🥃",
    "cashPerSec": 3.02,
    "clickBoost": 2,
    "value": 2518,
    "img": "assets/alcool_jack_daniels.jpg",
    "desc": "La légendaire bouteille carrée filtrée goutte à goutte sur 3 mètres de charbon d'érable à Lynchburg, Tennessee. L'âme du rock 'n' roll mondial."
  },
  {
    "id": "chivas-12",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Chivas Regal 12 Ans",
    "emoji": "🥃",
    "cashPerSec": 1.38,
    "clickBoost": 1.21,
    "value": 834,
    "img": "assets/alcool_chivas.jpg",
    "desc": "Le grand blend de Strathisla, doyen des distilleries du Speyside. Texture voluptueuse, miel de bruyère, pommes mûres et noisettes torréfiées."
  },
  {
    "id": "absolut-vodka-blue",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Absolut Vodka Suède",
    "emoji": "🍶",
    "cashPerSec": 1.3,
    "clickBoost": 1.14,
    "value": 786,
    "img": "assets/alcool_absolut.jpg",
    "desc": "Distillation de haute pureté à partir de céréales d'hiver soigneusement triées et filtrée sur charbon actif. Clarté cristalline remarquable et texture soyeuse en bouche, idéale pure frappée ou sublimée en cocktail de prestige."
  },
  {
    "id": "jagermeister",
    "cat": "alcool",
    "rarity": "epique",
    "name": "Jägermeister Bouteille Culte aux 56 Herbes",
    "emoji": "🥃",
    "cashPerSec": 5.21,
    "clickBoost": 3.3,
    "value": 4715,
    "img": "assets/alcool_jagermeister.jpg",
    "desc": "Liqueur aux 56 plantes botaniques originaire de Wolfenbüttel en Allemagne. Servie à -18°C dans un shot givré, elle est l'icône indéboulonnable des soirées rock et festivals."
  },
  {
    "id": "chartreuse-verte",
    "cat": "alcool",
    "rarity": "epique",
    "name": "Chartreuse Verte 55°",
    "emoji": "🍵",
    "cashPerSec": 4.53,
    "clickBoost": 2.9,
    "value": 4033,
    "img": "assets/alcool_chartreuse.jpg",
    "desc": "Liqueur aux 130 plantes médicinales secrètes transmise par le manuscrit de 1605 aux moines de la Grande Chartreuse à Voiron. Puissance aromatique herbeuse unique au monde."
  },
  {
    "id": "don-julio-1942",
    "cat": "alcool",
    "rarity": "epique",
    "name": "Don Julio 1942 Añejo",
    "emoji": "🍸",
    "cashPerSec": 5.13,
    "clickBoost": 3.3,
    "value": 4635,
    "img": "assets/alcool_don_julio.jpg",
    "desc": "Tequila 100% Agave Bleue Weber cultivée sur les hauts plateaux de Jalisco au Mexique. Cuisson lente des piñas en fours de maçonnerie traditionnels et distillation en alambic de cuivre."
  },
  {
    "id": "lagavulin-16",
    "cat": "alcool",
    "rarity": "legendaire",
    "name": "Lagavulin 16 Ans Islay",
    "emoji": "🥃",
    "cashPerSec": 12.71,
    "clickBoost": 6.3,
    "value": 16335,
    "img": "assets/alcool_lagavulin.jpg",
    "desc": "Le titan d'Islay vieilli 16 ans au bord de l'océan atlantique. Tourbe phénolique intense, fumée d'âtre iodée, sel marin et richesse veloutée de fruits secs et de chêne."
  },
  {
    "id": "veuve-clicquot",
    "cat": "alcool",
    "rarity": "legendaire",
    "name": "Veuve Clicquot Brut",
    "emoji": "🍾",
    "cashPerSec": 19.84,
    "clickBoost": 9.4,
    "value": 29700,
    "img": "assets/alcool_veuve_clicquot.png",
    "desc": "Joyau effervescent des grandes célébrations et des maisons de craie champenoises. Effervescence fine et aérienne, robe d'or étincelante et notes briochées de fruits blancs mûris au soleil pour un toast inoubliable."
  },
  {
    "id": "dom-perignon-luminous",
    "cat": "alcool",
    "rarity": "legendaire",
    "name": "Dom Pérignon Vintage Luminous",
    "emoji": "🍾",
    "cashPerSec": 16,
    "clickBoost": 7.8,
    "value": 22500,
    "img": "assets/alcool_dom_perignon.jpg",
    "desc": "Joyau effervescent des grandes célébrations et des maisons de craie champenoises. Effervescence fine et aérienne, robe d'or étincelante et notes briochées de fruits blancs mûris au soleil pour un toast inoubliable. Variante spécifique de la manufacture Dom Pérignon Vintage Luminous."
  },
  {
    "id": "grey-goose",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Grey Goose Vodka",
    "emoji": "🍸",
    "cashPerSec": 0.88,
    "clickBoost": 0.81,
    "value": 544,
    "img": "https://images.unsplash.com/photo-1605338003668-3850125ab924?w=400&q=80",
    "desc": "Distillation de haute pureté à partir de céréales d'hiver soigneusement triées et filtrée sur charbon actif. Clarté cristalline remarquable et texture soyeuse en bouche, idéale pure frappée ou sublimée en cocktail de prestige. Variante spécifique de la manufacture Grey Goose Vodka."
  },
  {
    "id": "belvedere",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Belvedere Vodka",
    "emoji": "🍸",
    "cashPerSec": 1.19,
    "clickBoost": 1.06,
    "value": 726,
    "img": "https://images.unsplash.com/photo-1595991209266-5ff5a3a2f008?w=400&q=80",
    "desc": "Distillation de haute pureté à partir de céréales d'hiver soigneusement triées et filtrée sur charbon actif. Clarté cristalline remarquable et texture soyeuse en bouche, idéale pure frappée ou sublimée en cocktail de prestige. Variante spécifique de la manufacture Belvedere Vodka."
  },
  {
    "id": "bacardi-superior",
    "cat": "alcool",
    "rarity": "epique",
    "name": "Bacardi Superior",
    "emoji": "🍹",
    "cashPerSec": 5.49,
    "clickBoost": 3.5,
    "value": 4990,
    "img": "https://images.unsplash.com/photo-1614315584288-518218151f49?w=400&q=80",
    "desc": "Distillé avec passion à partir de pure canne à sucre des Caraïbes et vieilli sous climat tropical. Développe des notes gourmandes de vanille bourbon, de mélasse ambrée et de fruits exotiques flambés au palais."
  },
  {
    "id": "captain-morgan",
    "cat": "alcool",
    "rarity": "peu-commune",
    "name": "Captain Morgan Spiced",
    "emoji": "🏴‍☠️",
    "cashPerSec": 0.28,
    "clickBoost": 0.33,
    "value": 151,
    "img": "https://images.unsplash.com/photo-1588673415132-7204f1a63c63?w=400&q=80",
    "desc": "Distillé avec passion à partir de pure canne à sucre des Caraïbes et vieilli sous climat tropical. Développe des notes gourmandes de vanille bourbon, de mélasse ambrée et de fruits exotiques flambés au palais. Variante spécifique de la manufacture Captain Morgan Spiced."
  },
  {
    "id": "havana-club-7",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Havana Club 7 Ans",
    "emoji": "🥃",
    "cashPerSec": 1.19,
    "clickBoost": 1.05,
    "value": 720,
    "img": "https://images.unsplash.com/photo-1598284693992-628b0561578e?w=400&q=80",
    "desc": "Distillé avec passion à partir de pure canne à sucre des Caraïbes et vieilli sous climat tropical. Développe des notes gourmandes de vanille bourbon, de mélasse ambrée et de fruits exotiques flambés au palais. Variante spécifique de la manufacture Havana Club 7 Ans."
  },
  {
    "id": "bombay-sapphire",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Bombay Sapphire Gin",
    "emoji": "🧊",
    "cashPerSec": 1.41,
    "clickBoost": 1.23,
    "value": 848,
    "img": "https://images.unsplash.com/photo-1609951651556-5334e2706168?w=400&q=80",
    "desc": "Gin aux 10 plantes botaniques rares du monde entier infusées par infusion de vapeur dans un alambic Carter-Head unique. Baies de genièvre, amandes d'Espagne et écorces de citron."
  },
  {
    "id": "hendricks-gin",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Hendrick's Gin",
    "emoji": "🥒",
    "cashPerSec": 0.99,
    "clickBoost": 0.9,
    "value": 609,
    "img": "https://images.unsplash.com/photo-1560512823-829485b8bf24?w=400&q=80",
    "desc": "Gin écossais atypique distillé en petits lots et sublimé par une infusion surprenante d'essence de concombre hollandais frais et de pétales de rose de Damas."
  },
  {
    "id": "glenfiddich-12",
    "cat": "alcool",
    "rarity": "rare",
    "name": "Glenfiddich 12 Ans",
    "emoji": "🥃",
    "cashPerSec": 1.16,
    "clickBoost": 1.03,
    "value": 704,
    "img": "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=400&q=80",
    "desc": "Le pionnier des single malts de Dufftown distillé dans des petits alambics en cuivre traditionnels en col de cygne. Arômes frais de poire Williams verte et chêne vanillé subtil."
  },
  {
    "id": "martini-rosso",
    "cat": "alcool",
    "rarity": "peu-commune",
    "name": "Martini Rosso",
    "emoji": "🍷",
    "cashPerSec": 0.26,
    "clickBoost": 0.31,
    "value": 137,
    "img": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80",
    "desc": "Boisson d'exception (Martini Rosso) réputée pour sa méthode de fabrication rigoureuse et son équilibre aromatique remarquable. Un incontournable des comptoirs et des grandes tables."
  },
  {
    "id": "aperol",
    "cat": "alcool",
    "rarity": "peu-commune",
    "name": "Aperol",
    "emoji": "🍹",
    "cashPerSec": 0.28,
    "clickBoost": 0.33,
    "value": 145,
    "img": "https://images.unsplash.com/photo-1563223771-4648b292e9db?w=400&q=80",
    "desc": "Amer apéritif iconique aux infusions d'herbes amères, de racines de gentiane sauvage et d'écorces d'oranges amères. La base indispensable du Spritz et du Negroni."
  },
  {
    "id": "cannabis-thc",
    "cat": "drogue",
    "rarity": "commune",
    "name": "THC · Tétrahydrocannabinol",
    "emoji": "💧",
    "cashPerSec": 0.11,
    "clickBoost": 0.17,
    "value": 42,
    "img": "assets/drogue_thc.jpg",
    "desc": "Fleurs manucurées gorgées de trichomes scintillants riches en delta-9-tétrahydrocannabinol et terpènes aromatiques (myrcène, caryophyllène, limonène). Relaxation physique et créativité cérébrale."
  },
  {
    "id": "cannabis-herbe",
    "cat": "drogue",
    "rarity": "epique",
    "name": "Weed Cali Kush & Fleur Sativa",
    "emoji": "🌿",
    "cashPerSec": 4.45,
    "clickBoost": 2.9,
    "value": 3950,
    "img": "assets/drogue_cannabis.jpg",
    "desc": "Sommités florales femelles givrées de trichomes ambrés. Variété californienne gorgée de terpènes de pin et d'agrumes, symbole de la culture West Coast."
  },
  {
    "id": "shit-marocain",
    "cat": "drogue",
    "rarity": "commune",
    "name": "Résine de Hashish du Rif",
    "emoji": "🍫",
    "cashPerSec": 0.1,
    "clickBoost": 0.15,
    "value": 40,
    "img": "assets/drogue_hashish.jpg",
    "desc": "Résine de fleurs femelles de Cannabis indica extraite par tamisage mécanique traditionnel dans les montagnes du Rif marocain. Arômes terreux, épicés et doux aux vertus relaxantes profondes."
  },
  {
    "id": "lsd-25",
    "cat": "drogue",
    "rarity": "peu-commune",
    "name": "LSD-25 · Diéthylamide",
    "emoji": "👁️",
    "cashPerSec": 0.23,
    "clickBoost": 0.28,
    "value": 119,
    "img": "assets/drogue_lsd.jpg",
    "desc": "Diéthylamide de l'acide lysergique synthétisé par Albert Hofmann en 1938 à Bâle. Agoniste puissant des récepteurs sérotoninergiques 5-HT2A, déclenchant synesthésies visuelles, dissolution de l'ego et altération profonde de la perception spatiotemporelle."
  },
  {
    "id": "cocaine-hcl",
    "cat": "drogue",
    "rarity": "rare",
    "name": "Cocaïne Chlorhydrate",
    "emoji": "❄️",
    "cashPerSec": 1.35,
    "clickBoost": 1.18,
    "value": 816,
    "img": "assets/drogue_cocaine.jpg",
    "desc": "Alcaloïde extrait des feuilles de l'arbuste Erythroxylum coca des Andes boliviennes et colombiennes. Bloqueur puissant de la recapture de la dopamine, noradrénaline et sérotonine, procurant assurance démesurée et stimulation cardiovasculaire vive."
  },
  {
    "id": "mdma-cristaux",
    "cat": "drogue",
    "rarity": "peu-commune",
    "name": "MDMA · Ecstasy Pure",
    "emoji": "🍬",
    "cashPerSec": 0.23,
    "clickBoost": 0.28,
    "value": 121,
    "img": "assets/drogue_mdma.jpg",
    "desc": "3,4-Méthylènedioxyméthamphétamine synthétisée en 1912 chez Merck. Puissant libérateur de sérotonine, dopamine et oxytocine, induisant euphorie intense, empathie universelle, connexion tactile et abolition de l'anxiété sociale dans les raves."
  },
  {
    "id": "ketamine-hcl",
    "cat": "drogue",
    "rarity": "peu-commune",
    "name": "Kétamine Anesthésique",
    "emoji": "🧪",
    "cashPerSec": 0.33,
    "clickBoost": 0.38,
    "value": 178,
    "img": "assets/drogue_ketamine.jpg",
    "desc": "Anesthésique dissociatif synthétisé en 1962 par Calvin Stevens, antagoniste non compétitif des récepteurs NMDA du glutamate. Déclenche une dissociation corps-esprit, distorsion temporelle et l'état introspectif profond du 'K-Hole'."
  },
  {
    "id": "psilocybine-champi",
    "cat": "drogue",
    "rarity": "peu-commune",
    "name": "Psilocybine Naturelle",
    "emoji": "🍄",
    "cashPerSec": 0.29,
    "clickBoost": 0.34,
    "value": 157,
    "img": "assets/drogue_psilocybine.jpg",
    "desc": "Alcaloïde phosphorylé naturellement présent dans les champignons sacrés du genre Psilocybe, utilisé lors des rituels mazatèques par Maria Sabina. Métabolisé en psilocine dans l'organisme pour ouvrir les portes de la perception mystique."
  },
  {
    "id": "dmt-molecule",
    "cat": "drogue",
    "rarity": "rare",
    "name": "DMT · Diméthyltryptamine",
    "emoji": "✨",
    "cashPerSec": 1,
    "clickBoost": 0.91,
    "value": 615,
    "img": "assets/drogue_dmt.jpg",
    "desc": "La 'molécule de l'esprit' présente dans de nombreuses plantes amazoniennes et naturellement sécrétée par le cerveau des mammifères. Déclenche une immersion instantanée dans des dimensions géométriques fractales d'une complexité vertigineuse."
  },
  {
    "id": "mescaline-peyotl",
    "cat": "drogue",
    "rarity": "peu-commune",
    "name": "Mescaline de Peyotl",
    "emoji": "🌵",
    "cashPerSec": 0.25,
    "clickBoost": 0.3,
    "value": 130,
    "img": "assets/drogue_mescaline.jpg",
    "desc": "Phénéthylamine psychédélique extraite des boutons charnus du cactus sacré Lophophora williamsii ou de l'Echinopsis pachanoi. Révélée par Aldous Huxley dans Les Portes de la perception pour ses visions lumineuses et chaleureuses."
  },
  {
    "id": "heroine-diamorphine",
    "cat": "drogue",
    "rarity": "rare",
    "name": "Héroïne · Pavot d'Orient",
    "emoji": "🌺",
    "cashPerSec": 1.19,
    "clickBoost": 1.06,
    "value": 722,
    "img": "assets/drogue_heroine.jpg",
    "desc": "Diacétylmorphine synthétisée en 1874 à partir de l'opium brut du pavot somnifère. Agoniste puissant des récepteurs opioïdes mu dans le système limbique, provoquant une chaleur intérieure bienfaisante, anxiolyse absolue et apaisement total de la douleur."
  },
  {
    "id": "morphine-base",
    "cat": "drogue",
    "rarity": "rare",
    "name": "Morphine Sulfatée",
    "emoji": "💉",
    "cashPerSec": 1.46,
    "clickBoost": 1.27,
    "value": 880,
    "img": "assets/drogue_morphine.jpg",
    "desc": "L'alcaloïde principal de l'opium nommé d'après Morphée, dieu grec des songes. L'étalon-or des antalgiques majeurs du système de santé mondial soulageant les douleurs les plus intenses."
  },
  {
    "id": "meth-crystal",
    "cat": "drogue",
    "rarity": "rare",
    "name": "Méthamphétamine Pure",
    "emoji": "💎",
    "cashPerSec": 0.93,
    "clickBoost": 0.85,
    "value": 576,
    "img": "assets/drogue_meth.jpg",
    "desc": "Psychostimulant de synthèse libérant massivement de la dopamine et noradrénaline dans le striatum et cortex préfrontal. Supprime la fatigue, décuple la vigilance, l'endurance et coupe net l'appétit pendant des heures."
  },
  {
    "id": "fentanyl-synthese",
    "cat": "drogue",
    "rarity": "epique",
    "name": "Fentanyl de Synthèse",
    "emoji": "🩹",
    "cashPerSec": 4.43,
    "clickBoost": 2.9,
    "value": 3933,
    "img": "assets/drogue_fentanyl.jpg",
    "desc": "Opioïde de synthèse développé par le Dr Paul Janssen en 1959. 50 à 100 fois plus puissant que la morphine, dosé au microgramme pour les anesthésies chirurgicales lourdes."
  },
  {
    "id": "oxycodone-80",
    "cat": "drogue",
    "rarity": "rare",
    "name": "Oxycodone 80mg",
    "emoji": "💊",
    "cashPerSec": 1.05,
    "clickBoost": 0.94,
    "value": 640,
    "img": "assets/drogue_oxycodone.jpg",
    "desc": "Opioïde semi-synthétique dérivé de la thébaïne au cœur de la crise américaine. Puissance analgésique 1,5 fois supérieure à la morphine procurant une euphorie douce et un soulagement absolu des maux."
  },
  {
    "id": "codeine-sirop",
    "cat": "drogue",
    "rarity": "epique",
    "name": "Dirty Sprite · Purple Drank / Lean",
    "emoji": "🍇",
    "cashPerSec": 4.53,
    "clickBoost": 2.9,
    "value": 4033,
    "img": "assets/drogue_codeine.jpg",
    "desc": "Le fameux mélange culte du sud des États-Unis et de la trap music : sirop codéiné violet, Sprite bien frais et bonbons Jolly Rancher dans un double gobelet en polystyrène."
  },
  {
    "id": "tramadol-capsule",
    "cat": "drogue",
    "rarity": "commune",
    "name": "Tramadol Chlorhydrate",
    "emoji": "💊",
    "cashPerSec": 0.06,
    "clickBoost": 0.1,
    "value": 28,
    "img": "assets/drogue_tramadol.jpg",
    "desc": "Composé psychoactif (Tramadol Chlorhydrate) rigoureusement documenté en pharmacologie pour son affinité sélective avec les neurotransmetteurs cérébraux et son histoire culturelle singulière."
  },
  {
    "id": "ghb-bouteille",
    "cat": "drogue",
    "rarity": "peu-commune",
    "name": "GHB · Flacon Liquide",
    "emoji": "🧪",
    "cashPerSec": 0.35,
    "clickBoost": 0.4,
    "value": 191,
    "img": "assets/drogue_ghb.jpg",
    "desc": "Acide gamma-hydroxybutyrique présent à l'état naturel dans le système nerveux central, agoniste des récepteurs GHB et GABA-B. Euphorie communicative, désinhibition sociale et relaxation corporelle à dose millimétrée."
  },
  {
    "id": "opium-brut",
    "cat": "drogue",
    "rarity": "rare",
    "name": "Opium Brut d'Orient",
    "emoji": "🪨",
    "cashPerSec": 0.95,
    "clickBoost": 0.87,
    "value": 588,
    "img": "assets/drogue_opium.jpg",
    "desc": "Suc laiteux séché extrait des capsules immatures de Papaver somniferum. Utilisé depuis Sumer et la Mésopotamie pour ses vertus sédatives et ses songes orientaux immortalisés par Thomas De Quincey."
  },
  {
    "id": "salvinorine-a",
    "cat": "drogue",
    "rarity": "rare",
    "name": "Salvinorine A Divinorum",
    "emoji": "🌿",
    "cashPerSec": 1.46,
    "clickBoost": 1.27,
    "value": 876,
    "img": "assets/drogue_salvinorine.jpg",
    "desc": "Diterpène non azoté extrait des feuilles de Salvia divinorum, agoniste sélectif puissant des récepteurs opioïdes kappa (KOR). Déclenche des distorsions spatiales physiques intenses et des voyages multidimensionnels de courte durée."
  },
  {
    "id": "ibogaine-afrique",
    "cat": "drogue",
    "rarity": "mythique",
    "name": "Ibogaïne Sacrée du Bwiti",
    "emoji": "🌳",
    "cashPerSec": 62.72,
    "clickBoost": 23.4,
    "value": 133920,
    "img": "assets/drogue_ibogaine.jpg",
    "desc": "Alcaloïde extrait de la racine de l'arbuste Tabernanthe iboga sacré chez les Bwiti au Gabon. Utilisé lors des initiations de passage et étudié en clinique pour réinitialiser les récepteurs neuronaux de la dépendance en un seul voyage onirique."
  },
  {
    "id": "adderall-dextro",
    "cat": "drogue",
    "rarity": "peu-commune",
    "name": "Adderall XR 30mg",
    "emoji": "💊",
    "cashPerSec": 0.21,
    "clickBoost": 0.26,
    "value": 105,
    "img": "assets/drogue_adderall.jpg",
    "desc": "Composé psychoactif (Adderall XR 30mg) rigoureusement documenté en pharmacologie pour son affinité sélective avec les neurotransmetteurs cérébraux et son histoire culturelle singulière."
  },
  {
    "id": "ritaline-methyl",
    "cat": "drogue",
    "rarity": "rare",
    "name": "Ritaline · Novartis",
    "emoji": "⚪",
    "cashPerSec": 1.31,
    "clickBoost": 1.15,
    "value": 793,
    "img": "assets/drogue_ritaline.jpg",
    "desc": "Composé psychoactif (Ritaline · Novartis) rigoureusement documenté en pharmacologie pour son affinité sélective avec les neurotransmetteurs cérébraux et son histoire culturelle singulière."
  },
  {
    "id": "modafinil-provigil",
    "cat": "drogue",
    "rarity": "peu-commune",
    "name": "Modafinil Éveil Extrême",
    "emoji": "💊",
    "cashPerSec": 0.28,
    "clickBoost": 0.33,
    "value": 150,
    "img": "assets/drogue_modafinil.jpg",
    "desc": "Composé psychoactif (Modafinil Éveil Extrême) rigoureusement documenté en pharmacologie pour son affinité sélective avec les neurotransmetteurs cérébraux et son histoire culturelle singulière."
  },
  {
    "id": "2cb-synthese",
    "cat": "drogue",
    "rarity": "rare",
    "name": "2C-B Nexus Phospho",
    "emoji": "⭐",
    "cashPerSec": 1.07,
    "clickBoost": 0.96,
    "value": 653,
    "img": "assets/drogue_2cb.jpg",
    "desc": "Phénéthylamine de synthèse créée par le chimiste Alexander Shulgin en 1974. Combine une stimulation corporelle empathogène douce avec des hallucinations visuelles colorées et une clarté mentale remarquable."
  },
  {
    "id": "poppers-rush",
    "cat": "drogue",
    "rarity": "commune",
    "name": "Poppers Rush",
    "emoji": "💥",
    "cashPerSec": 0.07,
    "clickBoost": 0.11,
    "value": 31,
    "img": "https://images.unsplash.com/photo-1584362917165-526a968579e8?w=400&q=80",
    "desc": "Composé psychoactif (Poppers Rush) rigoureusement documenté en pharmacologie pour son affinité sélective avec les neurotransmetteurs cérébraux et son histoire culturelle singulière."
  },
  {
    "id": "proto-ballon",
    "cat": "drogue",
    "rarity": "commune",
    "name": "Protoxyde d'Azote",
    "emoji": "🎈",
    "cashPerSec": 0.09,
    "clickBoost": 0.13,
    "value": 35,
    "img": "https://images.unsplash.com/photo-1530103043960-ef38714abb15?w=400&q=80",
    "desc": "Protoxyde d'azote (N2O) médical sous forme de gaz comprimé froid. Inhalé au ballon, il procure un étourdissement euphorique fugace, une voix modifiée et des éclats de rire irrépressibles de 60 secondes."
  },
  {
    "id": "ayahuasca-breuvage",
    "cat": "drogue",
    "rarity": "epique",
    "name": "Ayahuasca",
    "emoji": "🍵",
    "cashPerSec": 4.76,
    "clickBoost": 3.1,
    "value": 4260,
    "img": "https://images.unsplash.com/photo-1564865878688-9a244444042a?w=400&q=80",
    "desc": "Breuvage chamanique ancestral d'Amazonie alliant les lianes de Banisteriopsis caapi (inhibiteurs de la MAO) et les feuilles de Psychotria viridis (DMT). Rituel de guérison profonde et de nettoyage spirituel guidé par les chants d'Icaros."
  },
  {
    "id": "kratom-poudre",
    "cat": "drogue",
    "rarity": "commune",
    "name": "Kratom Maeng Da",
    "emoji": "🍃",
    "cashPerSec": 0.12,
    "clickBoost": 0.18,
    "value": 44,
    "img": "https://images.unsplash.com/photo-1611078728952-16782c589b98?w=400&q=80",
    "desc": "Composé psychoactif (Kratom Maeng Da) rigoureusement documenté en pharmacologie pour son affinité sélective avec les neurotransmetteurs cérébraux et son histoire culturelle singulière."
  },
  {
    "id": "pcp-angel-dust",
    "cat": "drogue",
    "rarity": "rare",
    "name": "PCP Poussière d'Ange",
    "emoji": "🌪️",
    "cashPerSec": 1.38,
    "clickBoost": 1.21,
    "value": 832,
    "img": "https://images.unsplash.com/photo-1598375086882-62283aeb0b34?w=400&q=80",
    "desc": "Poussière d'ange (Angel Dust) synthétisée dans les années 1950. Puissant anesthésique dissociatif induisant une insensibilité totale à la douleur, altération de l'image corporelle et force subjective décuplée."
  },
  {
    "id": "crack-galette",
    "cat": "drogue",
    "rarity": "rare",
    "name": "Crack (Galette)",
    "emoji": "🪨",
    "cashPerSec": 0.94,
    "clickBoost": 0.86,
    "value": 580,
    "img": "https://images.unsplash.com/photo-1620612143003-24151e29e92d?w=400&q=80",
    "desc": "Forme basifiée de chlorhydrate de cocaïne par adjonction de bicarbonate de soude. Libère des vapeurs inhalables franchissant la barrière hémato-encéphalique en 5 secondes pour un flash d'euphorie fulgurant mais éphémère."
  },
  {
    "id": "lsa-graines",
    "cat": "drogue",
    "rarity": "commune",
    "name": "Graines Morning Glory",
    "emoji": "🌸",
    "cashPerSec": 0.07,
    "clickBoost": 0.11,
    "value": 31,
    "img": "https://images.unsplash.com/photo-1520698947230-0199e13a40fc?w=400&q=80",
    "desc": "Composé psychoactif (Graines Morning Glory) rigoureusement documenté en pharmacologie pour son affinité sélective avec les neurotransmetteurs cérébraux et son histoire culturelle singulière."
  },
  {
    "id": "khat-feuilles",
    "cat": "drogue",
    "rarity": "commune",
    "name": "Khat de la Corne",
    "emoji": "🌿",
    "cashPerSec": 0.07,
    "clickBoost": 0.11,
    "value": 32,
    "img": "https://images.unsplash.com/photo-1589139886737-2fb040d754f9?w=400&q=80",
    "desc": "Composé psychoactif (Khat de la Corne) rigoureusement documenté en pharmacologie pour son affinité sélective avec les neurotransmetteurs cérébraux et son histoire culturelle singulière."
  },
  {
    "id": "actrice-clara-morgane",
    "cat": "actrice",
    "rarity": "mythique",
    "name": "Clara Morgane",
    "emoji": "👠",
    "cashPerSec": 55.02,
    "clickBoost": 21.3,
    "value": 113400,
    "img": "assets/actrice_clara_morgane.jpg",
    "desc": "L'icône absolue du charme français des années 2000, égérie Canal+ et femme d'affaires accomplie. Incarnation de l'élégance parisienne et de la sensualité chic reconnue internationalement."
  },
  {
    "id": "actrice-mia-khalifa",
    "cat": "actrice",
    "rarity": "mythique",
    "name": "Mia Khalifa",
    "emoji": "👠",
    "cashPerSec": 56.99,
    "clickBoost": 21.9,
    "value": 118640,
    "img": "assets/actrice_mia_khalifa.jpg",
    "desc": "Phénomène viral planétaire de 2014 devenu l'une des personnalités les plus recherchées de l'histoire d'Internet, avant de devenir commentatrice sportive et militante médiatique suivie par des dizaines de millions de fans."
  },
  {
    "id": "actrice-sasha-grey",
    "cat": "actrice",
    "rarity": "mythique",
    "name": "Sasha Grey",
    "emoji": "👠",
    "cashPerSec": 57.08,
    "clickBoost": 21.9,
    "value": 118880,
    "img": "assets/actrice_sasha_grey.jpg",
    "desc": "Artiste multidisciplinaire, actrice pour Steven Soderbergh (The Girlfriend Experience), musicienne industrielle et autrice. Personnalité d'une intelligence tranchante qui a redéfini les codes de l'industrie."
  },
  {
    "id": "actrice-riley-reid",
    "cat": "actrice",
    "rarity": "legendaire",
    "name": "Riley Reid",
    "emoji": "👠",
    "cashPerSec": 19.58,
    "clickBoost": 9.3,
    "value": 29220,
    "img": "assets/actrice_riley_reid.jpg",
    "desc": "La superstar américaine aux plus de 10 trophées consécutifs d'interprète féminine de l'année. Charisme immédiat, regard pétillant et record de vues planétaire."
  },
  {
    "id": "actrice-jenna-jameson",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Jenna Jameson",
    "emoji": "👠",
    "cashPerSec": 0.8,
    "clickBoost": 0.75,
    "value": 501,
    "img": "assets/actrice_jenna_jameson.jpg",
    "desc": "La toute première véritable mégastar multimédia de l'industrie adulte, autrice de best-sellers du New York Times et femme d'affaires ayant bâti un empire médiatique à Las Vegas."
  },
  {
    "id": "actrice-sunny-leone",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Sunny Leone",
    "emoji": "👠",
    "cashPerSec": 1.06,
    "clickBoost": 0.95,
    "value": 648,
    "img": "assets/actrice_sunny_leone.jpg",
    "desc": "Née au Canada dans une famille sikhe, reine des charts adultes des années 2000 devenue une superstar à succès de Bollywood et entrepreneuse mondiale."
  },
  {
    "id": "actrice-angela-white",
    "cat": "actrice",
    "rarity": "legendaire",
    "name": "Angela White",
    "emoji": "👠",
    "cashPerSec": 15.5,
    "clickBoost": 7.5,
    "value": 21570,
    "img": "assets/actrice_angela_white.jpg",
    "desc": "Productrice et actrice australienne diplômée en études de genre, considérée comme l'une des figures les plus puissantes et respectées du cinéma adulte contemporain."
  },
  {
    "id": "actrice-lana-rhoades",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Lana Rhoades",
    "emoji": "👠",
    "cashPerSec": 0.87,
    "clickBoost": 0.81,
    "value": 542,
    "img": "assets/actrice_lana_rhoades.jpg",
    "desc": "L'un des visages les plus célèbres d'Internet et podcasteuse star de Los Angeles, ayant dominé les classements mondiaux de streaming dès son arrivée."
  },
  {
    "id": "actrice-brandi-love",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Brandi Love",
    "emoji": "👠",
    "cashPerSec": 1.27,
    "clickBoost": 1.12,
    "value": 771,
    "img": "assets/actrice_brandi_love.jpg",
    "desc": "Figure emblématique de la catégorie des femmes d'affaires matures accomplies, conférencière et personnalité républicaine assumée du Midwest américain."
  },
  {
    "id": "actrice-nicole-aniston",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Nicole Aniston",
    "emoji": "👠",
    "cashPerSec": 1.27,
    "clickBoost": 1.12,
    "value": 766,
    "img": "assets/actrice_nicole_aniston.jpg",
    "desc": "L'icône californienne au regard azur et aux courbes athlétiques, figure emblématique des plus grandes productions américaines des années 2010."
  },
  {
    "id": "actrice-abella-danger",
    "cat": "actrice",
    "rarity": "epique",
    "name": "Abella Danger",
    "emoji": "👠",
    "cashPerSec": 3.62,
    "clickBoost": 2.4,
    "value": 3118,
    "img": "assets/actrice_abella_danger.jpg",
    "desc": "La force brute et l'énergie scénique la plus explosive de Miami. Lauréate de multiples trophées AVN Female Performer of the Year et personnalité ultra-populaire des réseaux sociaux."
  },
  {
    "id": "actrice-tori-black",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Tori Black",
    "emoji": "👠",
    "cashPerSec": 0.98,
    "clickBoost": 0.89,
    "value": 605,
    "img": "assets/actrice_tori_black.jpg",
    "desc": "Considérée par la critique comme l'une des plus grandes interprètes de tous les temps, lauréate record de 2 trophées consécutifs d'interprète féminine de l'année AVN."
  },
  {
    "id": "actrice-jesse-jane",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Jesse Jane",
    "emoji": "👠",
    "cashPerSec": 1.28,
    "clickBoost": 1.13,
    "value": 774,
    "img": "assets/actrice_jesse_jane.jpg",
    "desc": "Le visage de platine de la mythique maison Digital Playground et héroïne des blockbusters Pirates I & II au budget hollywoodien."
  },
  {
    "id": "actrice-kagney-linn",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Kagney Linn Karter",
    "emoji": "👠",
    "cashPerSec": 0.39,
    "clickBoost": 0.44,
    "value": 215,
    "img": "assets/actrice_kagney_linn_karter.jpg",
    "desc": "Tempérament de feu, crinière blonde et énergie débordante, l'une des actrices les plus intenses et populaires de sa génération."
  },
  {
    "id": "actrice-kayden-kross",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Kayden Kross",
    "emoji": "👠",
    "cashPerSec": 0.25,
    "clickBoost": 0.3,
    "value": 129,
    "img": "assets/actrice_kayden_kross.jpg",
    "desc": "Beauté sophistiquée diplômée d'université devenue réalisatrice acclamée, autrice et fondatrice de sa propre maison de production."
  },
  {
    "id": "actrice-stormy-daniels",
    "cat": "actrice",
    "rarity": "epique",
    "name": "Stormy Daniels",
    "emoji": "👠",
    "cashPerSec": 4.3,
    "clickBoost": 2.8,
    "value": 3798,
    "img": "assets/actrice_stormy_daniels.jpg",
    "desc": "Réalisatrice aux multiples récompenses et personnalité médiatique devenue un phénomène politique mondial au cœur de l'actualité américaine."
  },
  {
    "id": "actrice-lisa-ann",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Lisa Ann",
    "emoji": "👠",
    "cashPerSec": 1.42,
    "clickBoost": 1.23,
    "value": 852,
    "img": "assets/actrice_lisa_ann.jpg",
    "desc": "Légende vivante de l'industrie, célèbre pour sa parodie politique de Sarah Palin en 2008, devenue animatrice sur SiriusXM et agente sportive réputée."
  },
  {
    "id": "actrice-brigitte-lahaie",
    "cat": "actrice",
    "rarity": "epique",
    "name": "Brigitte Lahaie",
    "emoji": "👠",
    "cashPerSec": 3.29,
    "clickBoost": 2.2,
    "value": 2793,
    "img": "assets/actrice_brigitte_lahaie.jpg",
    "desc": "Pionnière légendaire de l'Âge d'Or du cinéma érotique français des années 1970 et voix culte de la radio RMC. Charisme indémodable et franchise désarmante."
  },
  {
    "id": "actrice-alexis-texas",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Alexis Texas",
    "emoji": "👠",
    "cashPerSec": 1,
    "clickBoost": 0.91,
    "value": 616,
    "img": "assets/actrice_alexis_texas.jpg",
    "desc": "La reine incontestée de Houston aux courbes spectaculaires, symbole de toute une génération de vidéos virales sur le web."
  },
  {
    "id": "actrice-asa-akira",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Asa Akira",
    "emoji": "👠",
    "cashPerSec": 1.35,
    "clickBoost": 1.18,
    "value": 814,
    "img": "assets/actrice_asa_akira.jpg",
    "desc": "Autrice de best-sellers, podcasteuse et membre du prestigieux Hall of Fame, réputée pour son humour piquant et son audace sans filtre."
  },
  {
    "id": "actrice-stoya",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Stoya",
    "emoji": "👠",
    "cashPerSec": 0.34,
    "clickBoost": 0.39,
    "value": 183,
    "img": "assets/actrice_stoya.jpg",
    "desc": "Artiste, chroniqueuse pour Vice et The Guardian, icône féministe de l'art érotique ayant redéfini l'esthétique adulte avec un regard d'auteur."
  },
  {
    "id": "actrice-bree-olson",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Bree Olson",
    "emoji": "👠",
    "cashPerSec": 0.42,
    "clickBoost": 0.47,
    "value": 234,
    "img": "assets/actrice_bree_olson.jpg",
    "desc": "Visage angélique et fougue indomptable, star des années 2000 ayant fait sensation dans la culture pop et les talk-shows américains."
  },
  {
    "id": "actrice-briana-banks",
    "cat": "actrice",
    "rarity": "epique",
    "name": "Briana Banks",
    "emoji": "👠",
    "cashPerSec": 5.5,
    "clickBoost": 3.5,
    "value": 4998,
    "img": "assets/actrice_briana_banks.jpg",
    "desc": "La déesse germano-américaine aux yeux émeraude, égérie incontournable des superproductions élégantes du début du millénaire."
  },
  {
    "id": "actrice-eva-elfie",
    "cat": "actrice",
    "rarity": "legendaire",
    "name": "Eva Elfie",
    "emoji": "👠",
    "cashPerSec": 15.04,
    "clickBoost": 7.3,
    "value": 20700,
    "img": "assets/actrice_eva_elfie.jpg",
    "desc": "Star russe de la génération Z récompensée aux AVN Awards et streameuse populaire sur Twitch. Douceur angélique et popularité fulgurante dans le monde entier."
  },
  {
    "id": "actrice-adriana-chechik",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Adriana Chechik",
    "emoji": "👠",
    "cashPerSec": 0.92,
    "clickBoost": 0.84,
    "value": 568,
    "img": "assets/actrice_adriana_chechik.jpg",
    "desc": "Performances physiques extrêmes, personnalité gaming débridée sur Twitch et dévouement total qui lui ont valu les plus grands honneurs de l'industrie."
  },
  {
    "id": "actrice-dani-daniels",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Dani Daniels",
    "emoji": "👠",
    "cashPerSec": 1.43,
    "clickBoost": 1.25,
    "value": 862,
    "img": "assets/actrice_dani_daniels.jpg",
    "desc": "Artiste peintre et réalisatrice au charme classique inimitable, mariant sensualité raffinée et sens artistique pointu."
  },
  {
    "id": "actrice-madison-ivy",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Madison Ivy",
    "emoji": "👠",
    "cashPerSec": 0.33,
    "clickBoost": 0.38,
    "value": 177,
    "img": "assets/actrice_madison_ivy.jpg",
    "desc": "Beauté germano-américaine au regard félin, figure culte des studios de Los Angeles et star des classements de streaming."
  },
  {
    "id": "actrice-valentina-nappi",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Valentina Nappi",
    "emoji": "👠",
    "cashPerSec": 0.22,
    "clickBoost": 0.27,
    "value": 113,
    "img": "assets/actrice_valentina_nappi.jpg",
    "desc": "Intellectuelle napolitaine passionnée de philosophie et d'art contemporain, égérie provocatrice de la culture underground italienne."
  },
  {
    "id": "actrice-kendra-sunderland",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Kendra Sunderland",
    "emoji": "👠",
    "cashPerSec": 0.43,
    "clickBoost": 0.48,
    "value": 237,
    "img": "assets/actrice_kendra_sunderland.jpg",
    "desc": "La célèbre étudiante de bibliothèque devenue superstar internationale du streaming et créatrice de contenu parmi les plus suivies au monde."
  },
  {
    "id": "actrice-gabbie-carter",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Gabbie Carter",
    "emoji": "👠",
    "cashPerSec": 1.38,
    "clickBoost": 1.21,
    "value": 832,
    "img": "assets/actrice_gabbie_carter.jpg",
    "desc": "Étoile montante foudroyante venue de l'Arkansas, propulsée numéro un mondial grâce à son naturel solaire et son enthousiasme communicatif."
  },
  {
    "id": "actrice-emily-willis",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Emily Willis",
    "emoji": "👠",
    "cashPerSec": 1.47,
    "clickBoost": 1.28,
    "value": 885,
    "img": "assets/actrice_emily_willis.jpg",
    "desc": "Danseuse classique d'origine argentine devenue l'une des actrices les plus élégantes et demandées du cinéma contemporain."
  },
  {
    "id": "actrice-elsa-jean",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Elsa Jean",
    "emoji": "👠",
    "cashPerSec": 0.25,
    "clickBoost": 0.3,
    "value": 127,
    "img": "assets/actrice_elsa_jean.jpg",
    "desc": "Silhouette menue et regard azur cristallin, incarnation de la douceur et du glamour moderne sur les plateaux de San Fernando Valley."
  },
  {
    "id": "actrice-cory-chase",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Cory Chase",
    "emoji": "👠",
    "cashPerSec": 0.3,
    "clickBoost": 0.35,
    "value": 161,
    "img": "assets/actrice_cory_chase.jpg",
    "desc": "Figure de proue incontestée de la catégorie mature et reine des réseaux sociaux, célèbre pour son charisme rassurant et sa beauté rayonnante."
  },
  {
    "id": "actrice-remy-lacroix",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Remy LaCroix",
    "emoji": "👠",
    "cashPerSec": 0.39,
    "clickBoost": 0.44,
    "value": 215,
    "img": "assets/actrice_remy_lacroix.jpg",
    "desc": "Danseuse de cerceau aérien et festivalière charismatique, connue pour sa grâce féline et ses scènes d'anthologie au début des années 2010."
  },
  {
    "id": "actrice-jessa-rhodes",
    "cat": "actrice",
    "rarity": "peu-commune",
    "name": "Jessa Rhodes",
    "emoji": "👠",
    "cashPerSec": 0.3,
    "clickBoost": 0.35,
    "value": 163,
    "img": "assets/actrice_jessa_rhodes.jpg",
    "desc": "Beauté originaire de l'Oregon aux talents de comédienne reconnus, pilier des grandes fictions scénarisées récompensées par l'AVN."
  },
  {
    "id": "actrice-gianna-michaels",
    "cat": "actrice",
    "rarity": "rare",
    "name": "Gianna Michaels",
    "emoji": "👠",
    "cashPerSec": 1.26,
    "clickBoost": 1.11,
    "value": 760,
    "img": "assets/actrice_gianna_michaels.jpg",
    "desc": "Énergie volcanique, rire franc et générosité légendaire qui en ont fait l'une des personnalités les plus attachantes et adorées du public."
  },
  {
    "id": "sauciflard-auvergne",
    "cat": "beauf",
    "rarity": "commune",
    "name": "Saucisson Sec d'Auvergne",
    "emoji": "🌭",
    "cashPerSec": 0.11,
    "clickBoost": 0.17,
    "value": 43,
    "img": "assets/beauf_saucisson.jpg",
    "desc": "Joyau de charcuterie artisanale issu du savoir-faire traditionnel de nos régions françaises. Viande de porc de qualité assaisonnée au poivre et affinée patiemment en cave de montagne pour des tranches savoureuses à partager à l'apéro."
  },
  {
    "id": "pastis-comptoir",
    "cat": "beauf",
    "rarity": "peu-commune",
    "name": "Verre Ballon de Pastis",
    "emoji": "🥃",
    "cashPerSec": 0.38,
    "clickBoost": 0.43,
    "value": 207,
    "img": "assets/beauf_pastis.jpg",
    "desc": "Le verre ballon gravé à la dose de jaune avec son glaçon qui tourne. Le cliquetis annonciateur de midi pile sous le soleil du boulodrome."
  },
  {
    "id": "terroir-terrine-campagne",
    "cat": "beauf",
    "rarity": "rare",
    "name": "Terrine de Campagne à l’Ancienne",
    "emoji": "🥩",
    "cashPerSec": 1.03,
    "clickBoost": 0.93,
    "value": 632,
    "img": "assets/cards/ter_terroir-terrine-campagne.webp",
    "desc": "Joyau de charcuterie artisanale issu du savoir-faire traditionnel de nos régions françaises. Viande de porc de qualité assaisonnée au poivre et affinée patiemment en cave de montagne pour des tranches savoureuses à partager à l'apéro. Variante spécifique de la manufacture Terrine de Campagne à l’Ancienne."
  },
  {
    "id": "marcel-blanc",
    "cat": "beauf",
    "rarity": "peu-commune",
    "name": "Marcel Blanc Tacheté",
    "emoji": "🎽",
    "cashPerSec": 0.39,
    "clickBoost": 0.44,
    "value": 212,
    "img": "assets/beauf_marcel.jpg",
    "desc": "L'uniforme estival indétrônable combinant liberté totale de mouvement, aération optimale sous les bras et confort absolu pour aller chercher la baguette du matin."
  },
  {
    "id": "renault-magnum",
    "cat": "beauf",
    "rarity": "epique",
    "name": "Renault Magnum Routier",
    "emoji": "🚛",
    "cashPerSec": 3.66,
    "clickBoost": 2.4,
    "value": 3158,
    "img": "assets/beauf_camion.jpg",
    "desc": "Le monstre sacré des autoroutes des années 90 à cabine suspendue et plancher plat. Le roi incontesté des relais routiers et du canal 19 de la CB."
  },
  {
    "id": "kebab-complet",
    "cat": "beauf",
    "rarity": "commune",
    "name": "Kebab Sauce Blanche Chef",
    "emoji": "🥙",
    "cashPerSec": 0.11,
    "clickBoost": 0.17,
    "value": 43,
    "img": "assets/beauf_kebab.jpg",
    "desc": "Pain pita bien chaud garni de lamelles de veau grillées à la broche, oignons crus, salade, tomates et double dose de sauce blanche chef."
  },
  {
    "id": "puff-rechargeable",
    "cat": "beauf",
    "rarity": "rare",
    "name": "Puff Pastèque 9000 Puffs",
    "emoji": "💨",
    "cashPerSec": 1.22,
    "clickBoost": 1.08,
    "value": 740,
    "img": "assets/cig_puff.jpg",
    "desc": "Vape jetable rechargeable en USB-C qui embaume le bonbon chimique à dix mètres à la ronde. 9000 bouffées et des LED disco à chaque taffe."
  },
  {
    "id": "boules-petanque",
    "cat": "beauf",
    "rarity": "commune",
    "name": "Boules Obut Inox",
    "emoji": "🪨",
    "cashPerSec": 0.07,
    "clickBoost": 0.1,
    "value": 29,
    "img": "assets/beauf_boules_petanque.jpg",
    "desc": "Trois boules d'acier trempé striées 74mm qui claquent sur le gravier du boulodrome municipal. 'Tu tires ou tu pointes ?' suivi de la traditionnelle tournée de jaune au club-house."
  },
  {
    "id": "tongs-arena",
    "cat": "beauf",
    "rarity": "commune",
    "name": "Tongs Arena Claquettes",
    "emoji": "🩴",
    "cashPerSec": 0.1,
    "clickBoost": 0.15,
    "value": 38,
    "img": "assets/beauf_tongs_arena.jpg",
    "desc": "L'uniforme estival indétrônable combinant liberté totale de mouvement, aération optimale sous les bras et confort absolu pour aller chercher la baguette du matin. Variante spécifique de la manufacture Tongs Arena Claquettes."
  },
  {
    "id": "bob-cochonou",
    "cat": "beauf",
    "rarity": "peu-commune",
    "name": "Bob Cochonou Vichy",
    "emoji": "🧢",
    "cashPerSec": 0.42,
    "clickBoost": 0.47,
    "value": 230,
    "img": "assets/beauf_bob_cochonou.jpg",
    "desc": "Le fleuron de l'apéro franchouillard pur porc séché en boyau naturel. Se découpe au couteau de poche sur un coin de table en formica avec un verre de gros rouge qui tache."
  },
  {
    "id": "biere-86",
    "cat": "beauf",
    "rarity": "peu-commune",
    "name": "Cannette 8.6 Tiède",
    "emoji": "🍺",
    "cashPerSec": 0.34,
    "clickBoost": 0.39,
    "value": 183,
    "img": "assets/beauf_biere_86.jpg",
    "desc": "La canette de 50cl dorée servie tiède au cul du coffre. Le carburant brutal des après-midi qui dérivent doucement vers la nuit."
  },
  {
    "id": "siege-decathlon",
    "cat": "beauf",
    "rarity": "peu-commune",
    "name": "Siège Pliant Décathlon",
    "emoji": "🪑",
    "cashPerSec": 0.35,
    "clickBoost": 0.4,
    "value": 188,
    "img": "assets/beauf_siege_decathlon.jpg",
    "desc": "Le fauteuil pliant vert olive avec filet porte-gobelet dans l'accoudoir droit. Confort spartiate mais déplié en deux secondes chrono."
  },
  {
    "id": "aileron-carbone",
    "cat": "beauf",
    "rarity": "rare",
    "name": "Aileron Tuning Carbone",
    "emoji": "🏎️",
    "cashPerSec": 1.17,
    "clickBoost": 1.04,
    "value": 713,
    "img": "assets/beauf_aileron_carbone.jpg",
    "desc": "Aileron double lame vissé directement sur le hayon de la 206. Gain d'appui aérodynamique contestable, mais respect immédiat sur le parking du centre commercial."
  },
  {
    "id": "glaciere-bleue",
    "cat": "beauf",
    "rarity": "peu-commune",
    "name": "Glacière Bleue Rigide",
    "emoji": "🧊",
    "cashPerSec": 0.34,
    "clickBoost": 0.39,
    "value": 186,
    "img": "assets/beauf_glaciere_bleue.jpg",
    "desc": "La boîte bleue isotherme increvable remplie de pains de glace qui garde les canettes bien fraîches jusqu'au coucher du soleil sur la crique."
  },
  {
    "id": "camping-gaz",
    "cat": "beauf",
    "rarity": "rare",
    "name": "Réchaud Camping-Gaz",
    "emoji": "🔥",
    "cashPerSec": 0.88,
    "clickBoost": 0.81,
    "value": 546,
    "img": "assets/beauf_camping_gaz.jpg",
    "desc": "La boîte bleue isotherme increvable remplie de pains de glace qui garde les canettes bien fraîches jusqu'au coucher du soleil sur la crique. Variante spécifique de la manufacture Réchaud Camping-Gaz."
  },
  {
    "id": "tshirt-johnny",
    "cat": "beauf",
    "rarity": "rare",
    "name": "T-shirt Loup de Johnny",
    "emoji": "🐺",
    "cashPerSec": 1.22,
    "clickBoost": 1.08,
    "value": 740,
    "img": "assets/beauf_tshirt_johnny.jpg",
    "desc": "La bande-son officielle des fins de soirées de mariage et des autoroutes du soleil entonnée à pleins poumons fenêtres grandes ouvertes."
  },
  {
    "id": "autoradio-alpine",
    "cat": "beauf",
    "rarity": "epique",
    "name": "Autoradio Alpine CD",
    "emoji": "🎵",
    "cashPerSec": 4.99,
    "clickBoost": 3.2,
    "value": 4490,
    "img": "assets/beauf_autoradio_alpine.jpg",
    "desc": "Façade détachable avec écran rétroéclairé bleu fluo et fente pour CD gravé MP3. Fait vibrer les garnitures de portières sur du bon vieux son."
  }
];

// ============================================================
// SYSTÈME DE CATALOGUE & BOOSTER (100% CARTES UNIQUES - SANS VARIANTES)
// La rareté est inhérente à la carte elle-même.
// ============================================================

const RARITY_ORDER = ['commune','peu-commune','rare','epique','legendaire','mythique'];

let ALL_BASE_ITEMS_MAP = new Map();

function buildAllBaseItems() {
  // 1. Ajouter les cartes déjà présentes dans EMPIRE_DB
  if (typeof EMPIRE_DB !== 'undefined' && Array.isArray(EMPIRE_DB)) {
    EMPIRE_DB.forEach(item => {
      if (!ALL_BASE_ITEMS_MAP.has(item.id)) {
        ALL_BASE_ITEMS_MAP.set(item.id, item);
      }
    });
  }

  // 2. Intégrer les cigarettes authentiques du monde depuis CIGARETTES_DB si disponible
  const cigSource = (typeof window !== 'undefined' && window.CIGARETTES_DB) ||
                    (typeof globalThis !== 'undefined' && globalThis.CIGARETTES_DB) ||
                    (typeof CIGARETTES_DB !== 'undefined' ? CIGARETTES_DB : null);
  if (cigSource && Array.isArray(cigSource)) {
    cigSource.forEach(c => {
      if (!ALL_BASE_ITEMS_MAP.has(c.id)) {
        const r = c.rarity || 'commune';
        const cfg = EMPIRE_RARITIES[r] || EMPIRE_RARITIES.commune;
        const cigItem = {
          id: c.id,
          cat: 'cigarette',
          rarity: r,
          name: c.name,
          emoji: '🚬',
          cashPerSec: cfg.cashPerSec,
          clickBoost: cfg.clickBoost,
          value: cfg.valueBase,
          img: c.image || (c.id ? `assets/cards/cig_${c.id}.webp` : null),
          desc: c.desc || `Paquet de cigarettes authentique (${c.brand || 'Monde'}).`
        };
        EMPIRE_DB.push(cigItem);
        ALL_BASE_ITEMS_MAP.set(cigItem.id, cigItem);
      }
    });
  }

  // 3. Intégrer l'extension complète (Boissons cultes, Accessoires OCB/Raw/Purize, Terroirs, VIP, Substances)
  const expItems = (typeof window !== 'undefined' && window.EMPIRE_EXPANSION_ITEMS) ||
                   (typeof globalThis !== 'undefined' && globalThis.EMPIRE_EXPANSION_ITEMS) ||
                   (typeof EMPIRE_EXPANSION_ITEMS !== 'undefined' ? EMPIRE_EXPANSION_ITEMS : null);
  if (expItems && Array.isArray(expItems)) {
    expItems.forEach(it => {
      if (!ALL_BASE_ITEMS_MAP.has(it.id)) {
        EMPIRE_DB.push(it);
        ALL_BASE_ITEMS_MAP.set(it.id, it);
      }
    });
  }

  // 4. Cartes supplémentaires (footballeurs, actrices, boissons, terroirs, tabac, substances) : js/cards_extra.js
  const extra = (typeof window !== 'undefined' && window.EMPIRE_EXTRA_ITEMS) ||
                (typeof globalThis !== 'undefined' && globalThis.EMPIRE_EXTRA_ITEMS) || null;
  if (extra && Array.isArray(extra)) {
    extra.forEach(it => {
      if (!ALL_BASE_ITEMS_MAP.has(it.id)) {
        EMPIRE_DB.push(it);
        ALL_BASE_ITEMS_MAP.set(it.id, it);
      }
    });
  }
}

function getAllBaseItemsList() {
  buildAllBaseItems();
  return Array.from(ALL_BASE_ITEMS_MAP.values());
}

function getEmpireItemById(fullId) {
  buildAllBaseItems();
  if (ALL_BASE_ITEMS_MAP.has(fullId)) {
    return ALL_BASE_ITEMS_MAP.get(fullId);
  }

  // Rétrocompatibilité pour d'anciennes sauvegardes
  const baseId = fullId.split('__')[0];
  if (ALL_BASE_ITEMS_MAP.has(baseId)) {
    return ALL_BASE_ITEMS_MAP.get(baseId);
  }

  // Aliases de dédoublonnage (ex: act-abella-danger -> actrice-abella-danger)
  if (fullId && fullId.startsWith('act-')) {
    const actriceAlias = 'actrice-' + fullId.slice(4);
    if (ALL_BASE_ITEMS_MAP.has(actriceAlias)) {
      return ALL_BASE_ITEMS_MAP.get(actriceAlias);
    }
  }
  const ALCOHOL_ALIASES = {
    "alc-absolut-vodka-original": "absolut-vodka-blue",
    "alc-absolut-citron": "absolut-vodka-blue",
    "alc-absolut-vanilia": "absolut-vodka-blue",
    "alc-grey-goose-original": "grey-goose",
    "alc-belvedere-pure": "belvedere",
    "alc-corona-extra": "corona-extra",
    "alc-guinness-draught": "guinness-draught",
    "alc-guinness-foreign-extra": "guinness-draught",
    "alc-bacardi-carta-blanca": "bacardi-superior",
    "alc-bacardi-carta-negra": "bacardi-superior",
    "alc-havana-club-7-anos": "havana-club-7",
    "alc-bombay-sapphire": "bombay-sapphire",
    "alc-bombay-bramble": "bombay-sapphire",
    "hennessy-vsop": "alc-hennessy-very-special-vs",
    "alc-hennessy-xo-the-original": "alc-hennessy-paradis",
    "alc-lagavulin-16-ans": "lagavulin-16",
    "alc-lagavulin-8-ans": "lagavulin-16",
    "alc-dom-perignon-rose-vintage": "dom-perignon-luminous",
    "alc-dom-perignon-p2-plenitude-2": "alc-dom-perignon-vintage",
    "alc-veuve-clicquot-brut-carte-jaune": "veuve-clicquot",
    "alc-glenfiddich-15-ans-solera": "glenfiddich-12",
    "alc-glenfiddich-18-ans-small-batch": "glenfiddich-12",
    "alc-johnnie-walker-green-label-15": "alc-johnnie-walker-black-label-12",
    "alc-johnnie-walker-king-george-v": "alc-johnnie-walker-blue-label",
    "macallan-18": "alc-macallan-12-double-cask",
    "alc-macallan-15-triple-cask": "alc-macallan-12-double-cask",
    "alc-macallan-18-sherry-oak": "alc-macallan-12-double-cask",
    "alc-macallan-25-sherry-oak": "alc-macallan-1926-valerio-adami",
    "alc-ardbeg-uigeadail": "alc-ardbeg-10-ans",
    "alc-glenmorangie-lasanta-12": "alc-glenmorangie-the-original-10",
    "alc-glenmorangie-quinta-ruban-14": "alc-glenmorangie-the-original-10",
    "alc-beluga-transatlantic-racing": "alc-beluga-noble-russian-vodka",
    "alc-beluga-allure": "alc-beluga-gold-line",
    "alc-appleton-estate-12-ans-rare-casks": "appleton-estate-signature",
    "alc-patron-reposado": "alc-patron-silver",
    "alc-clase-azul-gold": "alc-clase-azul-reposado",
    "alc-clase-azul-ultra": "alc-clase-azul-reposado",
    "alc-courvoisier-vs": "alc-courvoisier-xo-imperial",
    "alc-courvoisier-vsop": "alc-courvoisier-xo-imperial",
    "alc-remy-martin-1738-accord-royal": "alc-remy-martin-vsop",
    "alc-martell-xo": "alc-martell-cordon-bleu",
    "alc-bollinger-rd-recemment-degorge": "alc-bollinger-la-grande-annee",
    "alc-leffe-brune": "alc-leffe-blonde",
    "alc-don-papa-10-ans": "alc-don-papa-7-ans",
    "soft-coca-cherry": "soft-coca-verre",
    "soft-coca-vanilla": "soft-coca-verre",
    "alc-san-miguel-pale-pilsen": "alc-san-miguel-especial",
    "alc-sierra-antiguo-anejo": "alc-sierra-tequila-silver",
    "alc-the-glenlivet-18-ans": "alc-the-glenlivet-12-ans",
    "alc-chartreuse-jaune-43": "chartreuse-verte",
    "dro-codeine-sirop-purple-drank-lean": "codeine-sirop",
    "dro-mdma-pilule-punisher-bleu-300mg": "dro-mdma-pilule-tesla-orange"
};
  if (ALCOHOL_ALIASES[fullId] && ALL_BASE_ITEMS_MAP.has(ALCOHOL_ALIASES[fullId])) {
    return ALL_BASE_ITEMS_MAP.get(ALCOHOL_ALIASES[fullId]);
  }

  return null;
}

function drawEmpirePack(packId, pityState = {}) {
  buildAllBaseItems();
  const pack = EMPIRE_PACKS[packId];
  if (!pack) return [];

  const pool = [];
  for (const item of ALL_BASE_ITEMS_MAP.values()) {
    if (pack.categories.includes(item.cat)) pool.push(item);
  }
  if (pool.length === 0) return [];

  const results = [];
  let packsOpenedSincePity = pityState[pack.id + '_packs'] || 0;
  packsOpenedSincePity++;
  let triggerPity = false;
  if (packsOpenedSincePity >= pack.pityThreshold) {
    triggerPity = true;
    packsOpenedSincePity = 0;
  }
  pityState[pack.id + '_packs'] = packsOpenedSincePity;

  for (let i = 0; i < pack.count; i++) {
    let rarity;
    if (i === 0 && triggerPity) {
      rarity = pack.pityRarity;
    } else {
      rarity = rollRarity(pack.odds);
    }

    let candidates = pool.filter(c => c.rarity === rarity);
    if (candidates.length === 0) {
      candidates = pool;
    }
    const drawnItem = candidates[Math.floor(Math.random() * candidates.length)];
    results.push(drawnItem);
  }

  return results;
}

function rollRarity(odds) {
  const r = Math.random();
  let acc = 0;
  for (const [rarity, prob] of Object.entries(odds)) {
    acc += prob;
  }
  let roll = r * acc;
  for (const [rarity, prob] of Object.entries(odds)) {
    roll -= prob;
    if (roll <= 0) return rarity;
  }
  return 'commune';
}

function getTotalCatalogCount() {
  buildAllBaseItems();
  return ALL_BASE_ITEMS_MAP.size;
}

buildAllBaseItems();
console.log(`[Empire DB] Initialisé avec ${ALL_BASE_ITEMS_MAP.size} cartes uniques (rareté fixe par carte).`);

if (typeof window !== "undefined") {
  window.getAllBaseItemsList = getAllBaseItemsList;
  window.buildAllBaseItems = buildAllBaseItems;
  window.getTotalCatalogCount = getTotalCatalogCount;
  window.getEmpireItemById = getEmpireItemById;
  window.drawEmpirePack = drawEmpirePack;
  window.EMPIRE_DB = EMPIRE_DB;
  window.EMPIRE_RARITIES = EMPIRE_RARITIES;
  window.EMPIRE_PACKS = EMPIRE_PACKS;
}

if (typeof module !== "undefined") {
  module.exports = {
    getAllBaseItemsList,
    buildAllBaseItems,
    getTotalCatalogCount,
    getEmpireItemById,
    drawEmpirePack,
    EMPIRE_DB,
    EMPIRE_RARITIES,
    EMPIRE_PACKS
  };
}
