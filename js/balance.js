// ============================================================
// THE ASHTRAY KING — Équilibrage de l'économie (un seul endroit pour tout régler)
//
// Objectif : progression LENTE et méritée. Pour un joueur qui joue 1 h par jour (simulation sur le vrai code,
// voir scripts/simulate_economy.js) : ~40 paquets la 1re semaine, ~300 le 1er mois, ~1 500 en 3 mois et environ
// 90 % des cartes en un an. Un joueur à 3 h par jour y arrive en ~3 mois.
//
// Comment : toute la monnaie est « à l'échelle » (clic de base 12 €, paquets ×40, cote des cartes ×40) et les
// revenus des cartes très rares sont réduits. Les cartes Mythiques et Légendaires rapportent moins qu'avant.
// Pour changer le rythme : modifier PRICE_MULT / VALUE_MULT (plus haut = plus lent) puis relancer la simulation.
// ============================================================

const Balance = (() => {
  const VERSION = 2;                 // à incrémenter si on change les valeurs : les anciennes sauvegardes sont converties
  const PRICE_MULT = 40;             // prix des paquets
  const VALUE_MULT = 40;             // cote des cartes (Bourse, revente)
  const BASE_CLICK = 12;             // gain d'un clic sans aucune carte
  const XP_PRICE_DIV = 1250;         // XP d'ouverture d'un paquet = prix / 1250 (minimum 15)
  const MONEY_FROM_V1 = 12;          // anciennes sauvegardes : l'argent est multiplié par 12
  // Revenu des cartes (€/s passif et bonus de clic) selon la rareté
  const RARITY_INCOME = { commune: 1, 'peu-commune': 1, rare: 1, epique: 0.875, legendaire: 0.75, mythique: 0.5 };

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

  return { VERSION, PRICE_MULT, VALUE_MULT, BASE_CLICK, XP_PRICE_DIV, MONEY_FROM_V1, init, xpForPack: price => Math.max(15, Math.round(price / XP_PRICE_DIV)) };
})();

if (typeof window !== 'undefined') window.Balance = Balance;
Balance.init();
