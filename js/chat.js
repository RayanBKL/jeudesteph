// ============================================================
// THE ASHTRAY KING — Chat (clan et messages entre amis)
// Fenêtre de discussion ouverte depuis les onglets Amis / Clan. Les messages sont lus toutes les 3 secondes
// tant que la fenêtre est ouverte. Tout le contenu venant d'un autre joueur est inséré avec textContent.
// ============================================================

const Chat = (() => {
  let cur = null;          // { scope, target, title, last, timer, el }

  const sb = () => window.sb;
  const fmtTime = t => { const d = new Date(t); return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };

  function close() {
    if (!cur) return;
    clearInterval(cur.timer);
    cur.el.remove();
    cur = null;
    if (window.Social && Social.refreshBadge) Social.refreshBadge();
  }

  function addMessages(list) {
    if (!cur || !list.length) return;
    const box = cur.el.querySelector('.chat-list');
    const stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
    cur.el.querySelector('.chat-empty')?.remove();
    list.forEach(m => {
      if (m.id <= cur.last) return;
      cur.last = m.id;
      const row = document.createElement('div');
      row.className = 'chat-msg' + (m.mine ? ' is-mine' : '');
      const head = document.createElement('div'); head.className = 'chat-head';
      const who = document.createElement('strong'); who.textContent = m.mine ? 'Toi' : m.pseudo;
      const time = document.createElement('span'); time.textContent = fmtTime(m.at);
      head.append(who, time);
      if (!m.mine) {
        const rep = document.createElement('button'); rep.className = 'chat-report'; rep.type = 'button'; rep.title = 'Signaler ce message'; rep.setAttribute('aria-label', 'Signaler'); rep.textContent = '⚑';
        rep.addEventListener('click', () => report(m.id, rep));
        head.append(rep);
      }
      const body = document.createElement('div'); body.className = 'chat-body'; body.textContent = m.body;
      row.append(head, body);
      box.append(row);
    });
    if (stick) box.scrollTop = box.scrollHeight;
  }

  async function report(id, btn) {
    const ok = await GameDialog.confirm('Un message contraire aux règles (insulte, harcèlement, spam) sera examiné par l\'administrateur.', { title: 'Signaler ce message ?', ok: 'Signaler', danger: true });
    if (!ok) return;
    const { error } = await sb().rpc('chat_report', { p_id: id, p_reason: null });
    if (error) return GameDialog.alert((error.message || 'Erreur').replace(/^.*?:\s*/, ''), { title: 'Signalement impossible' });
    btn.disabled = true; btn.textContent = '✓';
    if (typeof showToast === 'function') showToast('Merci, le message a été signalé.', 'info');
  }

  async function poll() {
    if (!cur || document.hidden) return;
    const c = cur;
    const { data, error } = await sb().rpc('chat_list', { p_scope: c.scope, p_target: c.target || null, p_after: c.last });
    if (cur !== c || error || !data) return;
    if (data.length) {
      addMessages(data);
      sb().rpc('chat_mark_read', { p_scope: c.scope, p_target: c.target || null, p_last: c.last }).then(() => {});
    }
  }

  async function send() {
    if (!cur) return;
    const input = cur.el.querySelector('.chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = ''; input.focus();
    const { error } = await sb().rpc('chat_send', { p_scope: cur.scope, p_target: cur.target || null, p_body: text });
    if (error) {
      input.value = text;
      const note = cur.el.querySelector('.chat-note');
      note.textContent = /Trop de requêtes/i.test(error.message) ? 'Doucement : trop de messages d\'un coup.' : (error.message || 'Envoi impossible').replace(/^.*?:\s*/, '');
      setTimeout(() => { if (note) note.textContent = ''; }, 3500);
      return;
    }
    poll();
  }

  // opts : { scope: 'clan' | 'dm', target: id de l'ami (dm), title }
  async function open(opts) {
    if (!window.sb || !(window.Account && Account.user)) return;
    close();
    const el = document.createElement('div');
    el.className = 'soc-modal chat-modal';
    el.innerHTML = `
      <div class="soc-modal-card chat-card" role="dialog" aria-modal="true">
        <div class="chat-top"><strong class="chat-title"></strong><button type="button" class="chat-close" aria-label="Fermer">✕</button></div>
        <div class="chat-list"><p class="chat-empty">Chargement…</p></div>
        <p class="chat-note"></p>
        <form class="chat-form"><input class="game-input chat-input" maxlength="300" placeholder="Ton message" autocomplete="off" /><button class="btn-empire btn-empire-primary" type="submit">Envoyer</button></form>
      </div>`;
    el.querySelector('.chat-title').textContent = opts.title || 'Discussion';
    document.body.appendChild(el);
    cur = { scope: opts.scope, target: opts.target || null, last: 0, el, timer: null };
    el.querySelector('.chat-close').addEventListener('click', close);
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelector('.chat-form').addEventListener('submit', e => { e.preventDefault(); send(); });
    el.querySelector('.chat-input').focus();
    const c = cur;
    const { data } = await sb().rpc('chat_list', { p_scope: c.scope, p_target: c.target, p_after: 0 });
    if (cur !== c) return;
    const box = el.querySelector('.chat-list');
    if (!data || !data.length) { box.querySelector('.chat-empty').textContent = c.scope === 'clan' ? 'Personne n\'a encore écrit. Lance la discussion.' : 'Aucun message. Dis bonjour.'; }
    else { addMessages(data); box.scrollTop = box.scrollHeight; sb().rpc('chat_mark_read', { p_scope: c.scope, p_target: c.target, p_last: c.last }).then(() => {}); }
    c.timer = setInterval(poll, 3000);
    document.addEventListener('keydown', function esc(e) { if (!cur) return document.removeEventListener('keydown', esc); if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(); } });
  }

  return { open, close };
})();

if (typeof window !== 'undefined') window.Chat = Chat;
