// ============================================================
// THE ASHTRAY KING — Historique des gains (casino, jeux instantanés, salle de jeux) et partage
// Une liste courte dans le navigateur (synchronisée avec la sauvegarde en ligne, clé « ak_gains »).
// ============================================================
const Gains = (() => {
  const KEY = 'ak_gains', MAX = 200;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (typeof formatCash === 'function' ? formatCash(n) : Math.round(n).toLocaleString('fr-FR'));
  const GAME_LABEL = { casino: 'Casino', online: 'Salle de jeux' };

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); } catch (e) {} }

  // type : 'win' | 'lose' | 'push' ; amount : gain NET en € (0 pour les parties sans argent)
  function add({ game, label, type, amount }) {
    const list = load();
    list.push({ t: Date.now(), game: game || 'casino', label: String(label || '').slice(0, 80), type: type || 'push', amount: Math.round(Number(amount) || 0) });
    save(list);
  }

  function stats(list) {
    const net = list.reduce((a, e) => a + (e.type === 'win' ? e.amount : e.type === 'lose' ? -e.amount : 0), 0);
    const best = list.reduce((m, e) => Math.max(m, e.type === 'win' ? e.amount : 0), 0);
    const wins = list.filter(e => e.type === 'win').length, losses = list.filter(e => e.type === 'lose').length;
    return { net, best, wins, losses, n: list.length };
  }

  // Texte à partager : une phrase, pas de chiffres inventés
  function shareText(e) {
    const where = e.label || GAME_LABEL[e.game] || 'The Ashtray King';
    if (e.type === 'win' && e.amount > 0) return `The Ashtray King : +${fmt(e.amount)} € sur ${where}. Tu fais mieux ?`;
    if (e.type === 'lose' && e.amount > 0) return `The Ashtray King : −${fmt(e.amount)} € sur ${where}. Le casino gagne toujours.`;
    return `The Ashtray King : partie sur ${where}, égalité.`;
  }
  async function share(e) {
    const text = shareText(e);
    try {
      if (navigator.share) { await navigator.share({ text, title: 'The Ashtray King' }); return; }
    } catch (err) { if (err && err.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); if (typeof showToast === 'function') showToast('Texte copié : colle-le où tu veux.', 'success'); }
    catch (err) { if (typeof showToast === 'function') showToast(text, 'info'); }
  }

  // Panneau : totaux + liste (filtre par type de jeu)
  function open(filter = 'all') {
    const all = load();
    const list = (filter === 'all' ? all : all.filter(e => e.game === filter)).slice().reverse();
    const s = stats(list);
    const el = document.createElement('div');
    el.className = 'soc-modal';
    const rows = list.slice(0, 60).map((e, i) => {
      const d = new Date(e.t), when = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const amt = e.type === 'win' ? `+${fmt(e.amount)} €` : e.type === 'lose' ? `−${fmt(e.amount)} €` : 'égalité';
      return `<div class="gn-row is-${e.type}"><span class="gn-when">${when}</span><span class="gn-what">${esc(e.label || GAME_LABEL[e.game] || '')}</span><span class="gn-amt">${amt}</span>${e.amount > 0 && e.type !== 'push' ? `<button class="btn-secondary pk-mini" data-share="${all.length - 1 - all.indexOf(e)}" data-i="${i}">Partager</button>` : ''}</div>`;
    }).join('');
    el.innerHTML = `<div class="soc-modal-card pp-card gn-card">
      <h3>Historique des gains</h3>
      <div class="gn-tabs">${[['all', 'Tout'], ['casino', 'Casino'], ['online', 'Salle de jeux']].map(([k, l]) => `<button class="btn-secondary pk-mini ${filter === k ? 'is-on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
      <div class="gn-stats">
        <div><span>Bilan net</span><b class="${s.net >= 0 ? 'pos' : 'neg'}">${s.net >= 0 ? '+' : '−'}${fmt(Math.abs(s.net))} €</b></div>
        <div><span>Meilleur gain</span><b>${fmt(s.best)} €</b></div>
        <div><span>Victoires / défaites</span><b>${s.wins} / ${s.losses}</b></div>
      </div>
      <div class="gn-list">${rows || '<p class="soc-empty">Pas encore de partie enregistrée.</p>'}</div>
      <button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button></div>`;
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-x]')) return el.remove();
      const f = e.target.closest('[data-filter]'); if (f) { el.remove(); open(f.dataset.filter); return; }
      const sh = e.target.closest('[data-share]'); if (sh) { const entry = all[+sh.dataset.share]; if (entry) share(entry); }
    });
    document.body.appendChild(el);
  }

  return { add, open, share, shareText, load, stats };
})();
if (typeof window !== 'undefined') window.Gains = Gains;
document.addEventListener('click', e => { if (e.target.closest('[data-gains]')) Gains.open(e.target.closest('[data-gains]').dataset.gains || 'all'); });
