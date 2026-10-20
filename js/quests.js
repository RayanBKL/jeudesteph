// ============================================================
// THE ASHTRAY KING — Quêtes du jour : 3 petites missions par jour (facile, moyenne, difficile), récompense à récupérer,
// série de jours d'affilée. Remise à zéro à minuit (heure de Paris). Alimenté par Prestige.emit (mêmes événements que les défis).
// ============================================================
const Quests = (() => {
  const KEY = 'ak_quests';
  const RARITY_RANK = { commune: 0, 'peu-commune': 1, rare: 2, epique: 3, legendaire: 4, mythique: 5 };
  // récompenses de base ; elles montent avec le niveau d'Empire (×1 au niveau 1, ×2 au niveau 20…)
  const POOL = {
    facile: [
      { id: 'packs3', text: 'Ouvre 3 paquets', target: 3, on: 'pack_open', cash: 1500, xp: 20 },
      { id: 'clics300', text: 'Clique 300 fois', target: 300, on: 'click', cash: 1500, xp: 20 },
      { id: 'play2', text: 'Joue 2 parties dans la salle de jeux', target: 2, on: 'game_end', cash: 2000, xp: 25 },
      { id: 'casino1', text: 'Gagne 1 fois au casino', target: 1, on: 'casino_win', cash: 2000, xp: 25 },
      { id: 'free1', text: 'Ouvre 1 paquet gratuit', target: 1, on: 'free_pack', cash: 1500, xp: 20 },
    ],
    moyenne: [
      { id: 'win2', text: 'Gagne 2 parties', target: 2, on: 'game_end', match: p => p.result === 'win', cash: 4000, xp: 40 },
      { id: 'rare1', text: 'Tire 1 carte Rare ou mieux', target: 1, on: 'card_drawn', match: p => RARITY_RANK[p.rarity] >= 2, cash: 4000, xp: 40 },
      { id: 'clics1500', text: 'Clique 1 500 fois', target: 1500, on: 'click', cash: 4000, xp: 40 },
      { id: 'poker1', text: 'Gagne 1 main de poker', target: 1, on: 'poker_win', cash: 5000, xp: 45 },
      { id: 'sell1', text: 'Vends 1 carte sur la Bourse', target: 1, on: 'market_sale', cash: 4500, xp: 40 },
    ],
    difficile: [
      { id: 'win4', text: 'Gagne 4 parties', target: 4, on: 'game_end', match: p => p.result === 'win', cash: 9000, xp: 80 },
      { id: 'epic1', text: 'Tire 1 carte Épique ou mieux', target: 1, on: 'card_drawn', match: p => RARITY_RANK[p.rarity] >= 3, cash: 10000, xp: 90 },
      { id: 'packs10', text: 'Ouvre 10 paquets', target: 10, on: 'pack_open', cash: 9000, xp: 80 },
      { id: 'casino3', text: 'Gagne 3 fois au casino', target: 3, on: 'casino_win', cash: 8000, xp: 70 },
    ],
  };
  const TIER_LABEL = { facile: 'Facile', moyenne: 'Moyenne', difficile: 'Difficile' };
  const STREAK_BONUS = { 3: 10000, 7: 50000, 14: 150000 };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (typeof formatCash === 'function' ? formatCash(n) : Math.round(n).toLocaleString('fr-FR'));
  const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' });     // créé une seule fois (le recréer à chaque appel est lent)
  const dayKey = () => DAY_FMT.format(new Date());
  const addDays = (k, n) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  let data = load();
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  function today() {
    const day = dayKey();
    const rnd = seeded('quetes-' + day), out = [];
    Object.entries(POOL).forEach(([tier, list]) => { const q = list[Math.floor(rnd() * list.length)]; out.push({ ...q, tier }); });
    return { day, quests: out };
  }
  function ensureDay() {
    const day = dayKey();
    if (data.day === day) return;
    if (data.completedDay !== addDays(day, -1)) data.streak = 0;     // la série continue seulement si hier était complété
    data.day = day; data.progress = {}; data.claimed = {};
    save();
  }
  const mult = () => { const lvl = (typeof ClickerEngine !== 'undefined' && ClickerEngine.getState) ? (ClickerEngine.getState().empireLevel || 1) : 1; return 1 + Math.min(lvl, 60) / 20; };

  function on(type, payload = {}) {
    ensureDay();
    let changed = false;
    today().quests.forEach(q => {
      if (q.on !== type || data.claimed[q.id]) return;
      if (q.match && !q.match(payload)) return;
      const before = data.progress[q.id] || 0;
      if (before >= q.target) return;
      data.progress[q.id] = Math.min(q.target, before + (payload.n || 1));
      changed = true;
      if (data.progress[q.id] >= q.target && typeof showToast === 'function') showToast(`Quête réussie : ${q.text}. Récupère ta récompense !`, 'gold');
    });
    if (changed) { save(); badge(); }
  }

  function claimable() { ensureDay(); return today().quests.filter(q => (data.progress[q.id] || 0) >= q.target && !data.claimed[q.id]).length; }
  function badge() { const n = claimable(); document.querySelectorAll('.quest-dot').forEach(d => { d.textContent = n || ''; d.classList.toggle('hidden', !n); }); }

  function claim(id) {
    ensureDay();
    const q = today().quests.find(x => x.id === id); if (!q || data.claimed[id] || (data.progress[id] || 0) < q.target) return;
    data.claimed[id] = true;
    const m = mult(), cash = Math.round(q.cash * m / 50) * 50, xp = Math.round(q.xp * m);
    if (typeof earnMoney === 'function') earnMoney(cash);
    if (typeof ClickerEngine !== 'undefined' && ClickerEngine.gainXP) ClickerEngine.gainXP(xp);
    let msg = `Quête récupérée : +${fmt(cash)} € et +${xp} XP`;
    // les 3 quêtes du jour faites : la série avance
    if (today().quests.every(x => data.claimed[x.id]) && data.completedDay !== data.day) {
      data.completedDay = data.day; data.streak = (data.streak || 0) + 1;
      const bonus = STREAK_BONUS[data.streak];
      if (bonus) { const b = Math.round(bonus * m / 50) * 50; if (typeof earnMoney === 'function') earnMoney(b); msg += ` · série de ${data.streak} jours : +${fmt(b)} €`; }
      if (typeof Achievements !== 'undefined') Achievements.on('quest_streak', { n: data.streak, set: true });
    }
    save(); badge();
    if (typeof showToast === 'function') showToast(msg, 'gold');
    if (typeof saveGame === 'function') saveGame();
    if (window.Account && Account.push) Account.push();
  }

  function msUntilReset() { const now = new Date(); const p = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' })); const next = new Date(p); next.setHours(24, 0, 0, 0); return next - p; }

  function open() {
    ensureDay();
    document.querySelectorAll('.soc-modal.quest-modal').forEach(m => m.remove());
    const { quests } = today(), m = mult();
    const left = msUntilReset(), h = Math.floor(left / 3600000), mi = Math.floor(left / 60000) % 60;
    const el = document.createElement('div');
    el.className = 'soc-modal quest-modal';
    el.innerHTML = `<div class="soc-modal-card pp-card">
      <h3>Quêtes du jour</h3>
      <p class="soc-empty">Nouvelles quêtes dans ${h} h ${mi} min · série : <b>${data.streak || 0}</b> jour${(data.streak || 0) > 1 ? 's' : ''} (bonus à 3, 7 et 14 jours)</p>
      <div class="quest-list">${quests.map(q => {
        const p = Math.min(q.target, data.progress[q.id] || 0), done = p >= q.target, got = data.claimed[q.id];
        const cash = Math.round(q.cash * m / 50) * 50, xp = Math.round(q.xp * m);
        return `<div class="quest-row ${done ? 'is-done' : ''} ${got ? 'is-got' : ''}">
          <div class="quest-top"><span class="quest-tier quest-${q.tier}">${TIER_LABEL[q.tier]}</span><strong>${esc(q.text)}</strong></div>
          <div class="quest-bar"><i style="width:${p / q.target * 100}%"></i><span>${fmt(p)} / ${fmt(q.target)}</span></div>
          <div class="quest-foot"><span>+${fmt(cash)} € · +${xp} XP</span>${got ? '<em>Récupérée</em>' : `<button class="btn-empire btn-empire-primary quest-claim" data-q="${q.id}" ${done ? '' : 'disabled'}>Récupérer</button>`}</div>
        </div>`; }).join('')}</div>
      <button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button></div>`;
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-x]')) return el.remove();
      const b = e.target.closest('[data-q]'); if (b && !b.disabled) { claim(b.dataset.q); el.remove(); open(); }
    });
    document.body.appendChild(el);
  }

  function init() {
    ensureDay(); badge();
    document.getElementById('btn-quests')?.addEventListener('click', open);
    setInterval(() => { ensureDay(); badge(); }, 60000);
  }
  return { on, open, init, claimable };
})();
if (typeof window !== 'undefined') window.Quests = Quests;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Quests.init()); else Quests.init();
