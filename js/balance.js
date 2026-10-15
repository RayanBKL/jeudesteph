// ============================================================
// THE ASHTRAY KING — Équilibrage de l'économie (un seul endroit pour tout régler)
//
// Objectif : progression LENTE et méritée. Le clic de base vaut 1 € (il monte avec l'arbre des talents et les cartes
// de clic). Pour un joueur qui joue 1 h par jour (simulation sur le vrai code, scripts/simulate_economy.js) :
// ~40 paquets la 1re semaine, ~400 le 1er mois, ~1 800 en 3 mois et ~85 % des cartes en un an. À 3 h par jour : ~6 mois.
//
// Comment : les paquets coûtent 12 fois plus qu'à l'origine, la cote des cartes aussi (revente ≈ 30-40 % du prix du
// paquet), et les cartes Rares, Épiques, Légendaires et Mythiques rapportent moins qu'avant (le revenu passif ne vient
// que des cartes placées dans les pièces de l'Empire).
// Pour changer le rythme : modifier PRICE_MULT / VALUE_MULT (plus haut = plus lent), mettre VERSION à jour, puis relancer la simulation.
// ============================================================

const Balance = (() => {
  const VERSION = 3;                 // à incrémenter si on change les valeurs : les anciennes sauvegardes sont converties
  const PRICE_MULT = 12;             // prix des paquets (par rapport aux prix d'origine de empire_db.js)
  const VALUE_MULT = 12;             // cote des cartes (Bourse, revente)
  const BASE_CLICK = 1;              // gain d'un clic sans aucune carte ni talent (monte avec l'arbre des talents et les cartes de clic)
  const XP_PRICE_DIV = 100 * PRICE_MULT;   // XP d'ouverture d'un paquet = prix d'origine / 100 (minimum 15)
  const CASH_CAP_ON_MIGRATION = 150000;    // anciennes sauvegardes : l'argent converti est plafonné (~10 paquets)
  // Revenu des cartes (€/s passif et bonus de clic) par rapport aux valeurs d'origine : les raretés hautes sont réduites
  const RARITY_INCOME = { commune: 1, 'peu-commune': 1, rare: 0.7, epique: 0.4, legendaire: 0.15, mythique: 0.06 };

  const r2 = v => Math.round(v * 100) / 100;

  function scaleItem(it) {
    if (!it || it._bal === VERSION) return;
    const f = RARITY_INCOME[it.rarity] || 1;
    if (typeof it.cashPerSec === 'number') it.cashPerSec = r2(it.cashPerSec * f);
    if (typeof it.clickBoost === 'number') it.clickBoost = r2(it.clickBoost * f);
    if (typeof it.value === 'number') it.value = Math.round(it.value * VALUE_MULT);
    it._bal = VERSION;
  }

  function init() {
    if (typeof buildAllBaseItems === 'function') buildAllBaseItems();     // crée toutes les cartes avant de les mettre à l'échelle
    if (typeof EMPIRE_DB !== 'undefined') EMPIRE_DB.forEach(scaleItem);
    if (typeof ALL_BASE_ITEMS_MAP !== 'undefined') ALL_BASE_ITEMS_MAP.forEach(scaleItem);
    if (typeof EMPIRE_PACKS !== 'undefined') {
      Object.values(EMPIRE_PACKS).forEach(p => { if (p._bal !== VERSION) { p.price = Math.round(p.price * PRICE_MULT); p._bal = VERSION; } });
    }
    if (typeof EMPIRE_RARITIES !== 'undefined') {
      Object.entries(EMPIRE_RARITIES).forEach(([k, c]) => {
        if (c._bal === VERSION) return;
        const f = RARITY_INCOME[k] || 1;
        c.cashPerSec = r2(c.cashPerSec * f); c.clickBoost = r2(c.clickBoost * f); c.valueBase = Math.round(c.valueBase * VALUE_MULT);
        c._bal = VERSION;
      });
    }
  }

  // Conversion des anciennes sauvegardes (version 1 = avant l'équilibrage, version 2 = 1re tentative avec clic à 12 €)
  function migrateFactors(from) {
    return from >= 2 ? { cash: 1 / 12, value: 12 / 40 } : { cash: 1, value: VALUE_MULT };
  }
  const capCash = v => Math.min(CASH_CAP_ON_MIGRATION, Math.round(v));

  return { VERSION, PRICE_MULT, VALUE_MULT, BASE_CLICK, XP_PRICE_DIV, migrateFactors, capCash, init, xpForPack: price => Math.max(15, Math.round(price / XP_PRICE_DIV)) };
})();

if (typeof window !== 'undefined') window.Balance = Balance;
Balance.init();
