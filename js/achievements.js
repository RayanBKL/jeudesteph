// ============================================================
// THE ASHTRAY KING — Succès et titres. Les succès se débloquent automatiquement ; certains donnent un TITRE à afficher sur le profil
// (à côté du pseudo, dans la page Profil et sur le profil public). Tout est cosmétique : aucune récompense en argent.
// ============================================================
const Achievements = (() => {
  const KEY = 'ak_ach', TITLE_KEY = 'ak_title';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (typeof formatCash === 'function' ? formatCash(n) : Math.round(n).toLocaleString('fr-FR'));
  const cs = () => (typeof ClickerEngine !== 'undefined' && ClickerEngine.getState) ? ClickerEngine.getState() : {};
  const inv = () => (typeof EmpireManager !== 'undefined' && EmpireManager.getInventory) ? EmpireManager.getInventory() : {};
  const owned = () => Object.keys(inv()).filter(id => inv()[id] > 0);
  const countRarity = r => owned().filter(id => { const it = getEmpireItemById(id); return it && it.rarity === r; }).length;
  const bestRank = () => { try { return Math.max(0, ...League.GAMES ? Object.keys(League.GAMES).map(g => League.getRank(g).index) : [0]); } catch (e) { return 0; } };
  const packs = () => { try { return (JSON.parse(localStorage.getItem('empire_state') || '{}').totalPacksOpened) || 0; } catch (e) { return 0; } };

  // compteurs d'événements (parties gagnées, casino, tournois…)
  let data = load();
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); d.c = d.c || {}; d.u = d.u || {}; return d; } catch (e) { return { c: {}, u: {} }; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  const C = k => data.c[k] || 0;

  // value() = progression actuelle ; goal = objectif ; title = titre débloqué (facultatif)
  const LIST = [
    // Collection
    { id: 'col10', name: 'Premiers pas', desc: 'Découvre 10 cartes', goal: 10, tier: 1, value: () => owned().length },
    { id: 'col100', name: 'Collectionneur', desc: 'Découvre 100 cartes', goal: 100, tier: 2, value: () => owned().length, title: 'Collectionneur' },
    { id: 'col500', name: 'Grand collectionneur', desc: 'Découvre 500 cartes', goal: 500, tier: 3, value: () => owned().length, title: 'Grand collectionneur' },
    { id: 'col2000', name: 'Musée vivant', desc: 'Découvre 2 000 cartes', goal: 2000, tier: 4, value: () => owned().length, title: 'Conservateur du Musée' },
    { id: 'myth1', name: 'Coup de chance', desc: 'Possède une carte Mythique', goal: 1, tier: 3, value: () => countRarity('mythique'), title: 'Veinard' },
    { id: 'myth10', name: 'Chasseur de mythes', desc: 'Possède 10 cartes Mythiques', goal: 10, tier: 4, value: () => countRarity('mythique'), title: 'Chasseur de Mythes' },
    { id: 'leg10', name: 'Légendaire', desc: 'Possède 10 cartes Légendaires', goal: 10, tier: 3, value: () => countRarity('legendaire') },
    { id: 'dbl', name: 'Brocanteur', desc: 'Garde 20 doubles en même temps', goal: 20, tier: 2, value: () => owned().filter(id => inv()[id] > 1).length },
    // Paquets et clics
    { id: 'pk10', name: 'Déchireur de paquets', desc: 'Ouvre 10 paquets', goal: 10, tier: 1, value: packs },
    { id: 'pk200', name: 'Pilier de boutique', desc: 'Ouvre 200 paquets', goal: 200, tier: 3, value: packs, title: 'Pilier de Boutique' },
    { id: 'clk1k', name: 'Pouce en feu', desc: 'Fais 1 000 clics', goal: 1000, tier: 1, value: () => cs().totalClicks || 0 },
    { id: 'clk50k', name: 'Pouce d\'acier', desc: 'Fais 50 000 clics', goal: 50000, tier: 3, value: () => cs().totalClicks || 0, title: 'Pouce d\'Acier' },
    { id: 'lvl10', name: 'Habitué', desc: 'Atteins le niveau 10', goal: 10, tier: 2, value: () => cs().empireLevel || 1 },
    { id: 'lvl30', name: 'Ancien du bar', desc: 'Atteins le niveau 30', goal: 30, tier: 3, value: () => cs().empireLevel || 1, title: 'Ancien du Bar' },
    { id: 'lvl60', name: 'Légende du quartier', desc: 'Atteins le niveau 60', goal: 60, tier: 4, value: () => cs().empireLevel || 1, title: 'Légende du Quartier' },
    // Salle de jeux
    { id: 'win10', name: 'Premier sang', desc: 'Gagne 10 parties en ligne', goal: 10, tier: 1, value: () => C('win') },
    { id: 'win100', name: 'Pilier de comptoir', desc: 'Gagne 100 parties en ligne', goal: 100, tier: 3, value: () => C('win'), title: 'Pilier de Comptoir' },
    { id: 'rank6', name: 'Buraliste', desc: 'Atteins le rang Buraliste dans un jeu', goal: 18, tier: 3, value: bestRank, title: 'Buraliste' },
    { id: 'rank24', name: 'Parrain', desc: 'Atteins le rang Parrain dans un jeu', goal: 24, tier: 4, value: bestRank, title: 'Parrain' },
    { id: 'rank25', name: 'Roi du Comptoir', desc: 'Atteins le rang Roi du Comptoir', goal: 25, tier: 5, value: bestRank, title: 'Roi du Comptoir' },
    // Casino et poker
    { id: 'cas10', name: 'Joueur', desc: 'Gagne 10 fois au casino', goal: 10, tier: 1, value: () => C('casino') },
    { id: 'cas200', name: 'Flambeur', desc: 'Gagne 200 fois au casino', goal: 200, tier: 3, value: () => C('casino'), title: 'Flambeur' },
    { id: 'bj5', name: 'Vingt-et-un', desc: 'Fais 5 blackjacks naturels', goal: 5, tier: 2, value: () => C('bj') },
    { id: 'pkr10', name: 'Bluffeur', desc: 'Gagne 10 mains de poker', goal: 10, tier: 2, value: () => C('poker'), title: 'Bluffeur' },
    { id: 'tour1', name: 'Vainqueur de tournoi', desc: 'Gagne un tournoi de poker', goal: 1, tier: 4, value: () => C('tourney_win'), title: 'Champion de Poker' },
    { id: 'tour3', name: 'Habitué des podiums', desc: 'Finis 3 fois sur le podium d\'un tournoi', goal: 3, tier: 3, value: () => C('tourney_podium') },
    // Bourse, quêtes, social
    { id: 'sell5', name: 'Marchand', desc: 'Vends 5 cartes sur la Bourse', goal: 5, tier: 2, value: () => C('sale'), title: 'Marchand' },
    { id: 'sell50', name: 'Roi de la Bourse', desc: 'Vends 50 cartes sur la Bourse', goal: 50, tier: 4, value: () => C('sale'), title: 'Roi de la Bourse' },
    { id: 'qs3', name: 'Régulier', desc: 'Termine les 3 quêtes du jour 3 jours de suite', goal: 3, tier: 2, value: () => C('quest_streak') },
    { id: 'qs14', name: 'Toujours là', desc: 'Termine les quêtes du jour 14 jours de suite', goal: 14, tier: 4, value: () => C('quest_streak'), title: 'Fidèle au Poste' },
    { id: 'frd3', name: 'Entouré', desc: 'Aie 3 amis', goal: 3, tier: 1, value: () => C('friends') },
    { id: 'clan', name: 'Membre du clan', desc: 'Rejoins un clan', goal: 1, tier: 1, value: () => C('clan'), title: 'Homme de Clan' },
  ];
  const TIER_NAME = ['', 'Bronze', 'Argent', 'Or', 'Platine', 'Légendaire'];

  function check(silent) {
    let fresh = [];
    LIST.forEach(a => {
      if (data.u[a.id]) return;
      let v = 0; try { v = a.value(); } catch (e) {}
      if (v >= a.goal) { data.u[a.id] = Date.now(); fresh.push(a); }
    });
    if (fresh.length) {
      save(); push();
      if (!silent && typeof showToast === 'function') fresh.slice(0, 3).forEach(a => showToast(`Succès : ${a.name}${a.title ? ' · titre « ' + a.title + ' » débloqué' : ''}`, 'gold'));
    }
    return fresh;
  }

  function on(type, p = {}) {
    if (type === 'game_end' && p.result === 'win') data.c.win = C('win') + 1;
    else if (type === 'casino_win') data.c.casino = C('casino') + 1;
    else if (type === 'blackjack') data.c.bj = C('bj') + 1;
    else if (type === 'poker_win') data.c.poker = C('poker') + 1;
    else if (type === 'market_sale') data.c.sale = C('sale') + (p.n || 1);
    else if (type === 'tourney_win') data.c.tourney_win = C('tourney_win') + 1;
    else if (type === 'tourney_podium') data.c.tourney_podium = C('tourney_podium') + 1;
    else if (type === 'quest_streak') data.c.quest_streak = Math.max(C('quest_streak'), p.n || 0);
    else if (type === 'friends') data.c.friends = Math.max(C('friends'), p.n || 0);
    else if (type === 'clan') data.c.clan = 1;
    else if (!['pack_open', 'click', 'card_drawn', 'rank_up'].includes(type)) return;
    if (['game_end', 'casino_win', 'blackjack', 'poker_win', 'market_sale', 'tourney_win', 'tourney_podium', 'quest_streak', 'friends', 'clan'].includes(type)) save();
    check(false);
  }

  const unlocked = () => LIST.filter(a => data.u[a.id]);
  const titles = () => unlocked().filter(a => a.title).map(a => a.title);
  const title = () => { try { return localStorage.getItem(TITLE_KEY) || ''; } catch (e) { return ''; } };
  function setTitle(t) { try { localStorage.setItem(TITLE_KEY, t || ''); } catch (e) {} push(); }
  // les 6 meilleurs succès (plus haut palier d'abord) affichés sur le profil public
  const topBadges = () => unlocked().sort((a, b) => b.tier - a.tier || data.u[b.id] - data.u[a.id]).slice(0, 6).map(a => a.id);

  let pushTimer = null;
  function push() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { if (window.sb && window.Account && Account.user) window.sb.rpc('profile_set_title', { p_title: title() || null, p_badges: topBadges() }).then(() => {}); }, 1500);
  }

  function medal(a, on) { return `<span class="ach-medal ach-t${a.tier} ${on ? 'is-on' : ''}" aria-hidden="true">${on ? '★' : '·'}</span>`; }
  function badgeHtml(id) { const a = LIST.find(x => x.id === id); return a ? `<span class="ach-chip ach-t${a.tier}" title="${esc(a.name)} : ${esc(a.desc)}">${medal(a, true)}${esc(a.name)}</span>` : ''; }

  // Bloc affiché dans la page Profil
  function renderProfile(host) {
    if (!host) return;
    check(true);
    const done = unlocked(), t = title(), tt = titles();
    host.innerHTML = `
      <div class="sc-head"><strong>Succès (${done.length}/${LIST.length})</strong>${tt.length ? `<select class="game-select-empire ach-title-sel" id="ach-title"><option value="">Aucun titre</option>${tt.map(x => `<option value="${esc(x)}" ${x === t ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}</div>
      <div class="ach-grid">${LIST.map(a => {
        const on = !!data.u[a.id]; let v = 0; try { v = Math.min(a.goal, a.value()); } catch (e) {}
        return `<button type="button" class="ach-card ach-t${a.tier} ${on ? 'is-on' : ''}" data-ach="${a.id}">${medal(a, on)}<span class="ach-name">${esc(a.name)}</span><span class="ach-prog">${on ? 'Débloqué' : fmt(v) + ' / ' + fmt(a.goal)}</span></button>`;
      }).join('')}</div>`;
    host.querySelector('#ach-title')?.addEventListener('change', e => { setTitle(e.target.value); });
    host.querySelectorAll('[data-ach]').forEach(b => b.addEventListener('click', () => {
      const a = LIST.find(x => x.id === b.dataset.ach); if (!a) return;
      if (typeof showToast === 'function') showToast(`${a.name} (${TIER_NAME[a.tier]}) : ${a.desc}${a.title ? ' · titre « ' + a.title + ' »' : ''}`, 'info');
    }));
  }

  function init() { setInterval(() => check(false), 20000); setTimeout(() => { check(true); push(); }, 4000); }
  return { on, check, renderProfile, badgeHtml, title, topBadges, init, LIST };
})();
if (typeof window !== 'undefined') window.Achievements = Achievements;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Achievements.init()); else Achievements.init();
