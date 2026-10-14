// ============================================================
// THE ASHTRAY KING — Amis, invitations à jouer et clans
// Tout est géré par le serveur (fonctions Supabase) : cet écran affiche et envoie des demandes.
// ============================================================

const Social = (() => {
  const GAME_NAMES = { pbc: 'Pierre-Briquet-Clope', des421: '421', quiz: 'Quiz du Comptoir' };
  let tab = 'profil';
  let clanView = 'mon';
  let inviteShown = null;
  let waiting = null;
  let started = false;

  const sb = () => window.sb;
  const online = () => !!(sb() && window.Account && Account.user);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const avatar = (p, cls = '') => `<span class="bd-avatar ${cls}">${p.avatar_small && /^data:image\//.test(p.avatar_small) ? `<img src="${esc(p.avatar_small)}" alt="">` : `<b>${esc((p.pseudo || '?').slice(0, 1).toUpperCase())}</b>`}</span>`;
  const msg = e => (e && e.message ? e.message : 'Erreur').replace(/^.*?:\s*/, '');

  // ── Démarrage : présence + invitations ──
  function start() {
    if (started || !online()) return;
    started = true;
    sb().rpc('touch_presence');
    setInterval(() => { if (!document.hidden) sb().rpc('touch_presence'); }, 60000);
    setInterval(() => { if (!document.hidden) pollInvites(); }, 5000);
    setInterval(() => { if (!document.hidden) refreshBadge(); }, 30000);
    refreshBadge();
    document.getElementById('btn-friends-top')?.addEventListener('click', () => openTab('amis'));
    document.querySelectorAll('#prof-tabs [data-ptab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.ptab; renderTabs(); }));
  }

  async function refreshBadge() {
    if (!online()) return;
    const { data } = await sb().rpc('friends_list');
    const n = (data || []).filter(f => f.rel === 'recue').length;
    ['badge-friends', 'top-friends-badge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = n; el.classList.toggle('hidden', !n); }
    });
  }

  // ── Onglets du profil ──
  function renderTabs() {
    document.querySelectorAll('#prof-tabs [data-ptab]').forEach(b => b.classList.toggle('active', b.dataset.ptab === tab));
    ['profil', 'amis', 'clan'].forEach(t => document.getElementById('prof-pane-' + t)?.classList.toggle('hidden', t !== tab));
    if (tab === 'amis') renderFriends();
    if (tab === 'clan') renderClan();
  }

  // ── Amis ──
  async function renderFriends() {
    const host = document.getElementById('prof-pane-amis');
    if (!host) return;
    if (!online()) { host.innerHTML = '<p class="soc-empty">Connecte-toi pour ajouter des amis.</p>'; return; }
    const { data, error } = await sb().rpc('friends_list');
    if (error) { host.innerHTML = `<p class="soc-empty">${esc(msg(error))}</p>`; return; }
    const list = data || [];
    const received = list.filter(f => f.rel === 'recue'), friends = list.filter(f => f.rel === 'ami'), sent = list.filter(f => f.rel === 'envoyee');
    const code = (Account.profile && Account.profile.friend_code) || '';
    const row = (f, actions) => `<div class="soc-row">${avatar(f)}<span class="soc-name"><strong>${esc(f.pseudo)}</strong><em>${f.rel === 'ami' ? `<i class="soc-dot ${f.online ? 'on' : ''}"></i>${f.online ? 'En ligne' : 'Hors ligne'} · ` : ''}Niv. ${f.level}</em></span>${actions}</div>`;
    host.innerHTML = `
      <form class="soc-add" id="soc-add">
        <input class="game-input" id="soc-add-input" maxlength="24" placeholder="Pseudo ou code ami" autocomplete="off" />
        <button class="btn-empire btn-empire-primary" type="submit">Ajouter</button>
      </form>
      <p class="soc-msg hidden" id="soc-msg"></p>
      ${code ? `<p class="soc-code">Ton code ami : <strong>${esc(code)}</strong></p>` : ''}
      <div class="soc-list">
        ${received.length ? `<h4>Demandes reçues</h4>${received.map(f => row(f, `<button class="btn-empire btn-empire-primary soc-btn" data-accept="${f.user_id}">Accepter</button><button class="btn-empire btn-empire-secondary soc-btn" data-refuse="${f.user_id}">✕</button>`)).join('')}` : ''}
        <h4>Mes amis (${friends.length})</h4>
        ${friends.length ? friends.map(f => row(f, `<button class="btn-empire btn-empire-primary soc-btn" data-duel="${f.user_id}" data-name="${esc(f.pseudo)}">Défier</button><button class="btn-empire btn-empire-secondary soc-btn" data-del="${f.user_id}" aria-label="Retirer">✕</button>`)).join('') : '<p class="soc-empty">Personne pour l\'instant. Ajoute quelqu\'un avec son pseudo ou son code ami.</p>'}
        ${sent.length ? `<h4>Demandes envoyées</h4>${sent.map(f => row(f, `<button class="btn-empire btn-empire-secondary soc-btn" data-del="${f.user_id}">Annuler</button>`)).join('')}` : ''}
      </div>`;
    const note = (t, bad) => { const m = host.querySelector('#soc-msg'); m.textContent = t; m.className = 'soc-msg' + (bad ? ' is-error' : ''); };
    host.querySelector('#soc-add').addEventListener('submit', async e => {
      e.preventDefault();
      const v = host.querySelector('#soc-add-input').value.trim();
      if (!v) return;
      const { data, error } = await sb().rpc('friend_request', { p_who: v });
      if (error) return note(msg(error), true);
      await renderFriends();
      const m = document.querySelector('#prof-pane-amis #soc-msg');
      if (m) { m.textContent = data.status === 'accepted' ? 'Vous êtes maintenant amis.' : 'Demande envoyée.'; m.className = 'soc-msg'; }
      refreshBadge();
    });
    host.querySelectorAll('[data-accept]').forEach(b => b.addEventListener('click', async () => { await sb().rpc('friend_respond', { p_other: b.dataset.accept, p_accept: true }); renderFriends(); refreshBadge(); }));
    host.querySelectorAll('[data-refuse]').forEach(b => b.addEventListener('click', async () => { await sb().rpc('friend_respond', { p_other: b.dataset.refuse, p_accept: false }); renderFriends(); refreshBadge(); }));
    host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!(await GameDialog.confirm('Elle ne sera plus dans ta liste d\'amis.', { title: 'Retirer cet ami ?', ok: 'Retirer', danger: true }))) return;
      await sb().rpc('friend_remove', { p_other: b.dataset.del }); renderFriends();
    }));
    host.querySelectorAll('[data-duel]').forEach(b => b.addEventListener('click', () => chooseGame(b.dataset.duel, b.dataset.name)));
  }

  // ── Défier un ami ──
  function modal(html) {
    closeModal();
    const el = document.createElement('div');
    el.className = 'soc-modal';
    el.innerHTML = `<div class="soc-modal-card">${html}</div>`;
    document.body.appendChild(el);
    return el;
  }
  function closeModal() { document.querySelectorAll('.soc-modal').forEach(m => m.remove()); }

  function chooseGame(friendId, name) {
    const el = modal(`<h3>Défier ${esc(name)}</h3><p class="soc-empty">Choisis le jeu. Les points de ligue comptent comme contre un inconnu.</p>
      ${Object.keys(GAME_NAMES).map(g => `<button class="btn-empire btn-empire-primary soc-wide" data-g="${g}">${GAME_NAMES[g]}</button>`).join('')}
      <button class="btn-empire btn-empire-secondary soc-wide" data-x>Annuler</button>`);
    el.querySelector('[data-x]').addEventListener('click', closeModal);
    el.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', async () => {
      const { data, error } = await sb().rpc('invite_send', { p_friend: friendId, p_game: b.dataset.g });
      if (error) { closeModal(); return GameDialog.alert(msg(error), { title: 'Invitation impossible' }); }
      waitForAnswer(data, name, b.dataset.g);
    }));
  }

  function waitForAnswer(inviteId, name, game) {
    const el = modal(`<h3>En attente de ${esc(name)}…</h3><div class="on-spinner"></div><p class="soc-empty">${GAME_NAMES[game]}. L'invitation expire au bout de 2 minutes.</p><button class="btn-empire btn-empire-secondary soc-wide" data-x>Annuler</button>`);
    waiting = setInterval(async () => {
      const { data } = await sb().rpc('invites_get');
      const inv = (data || []).find(i => i.id === inviteId);
      if (!inv) { clearInterval(waiting); closeModal(); showToast(`${name} n'a pas répondu.`, 'info'); }
      else if (inv.status === 'accepted') { clearInterval(waiting); closeModal(); goPlay(inv.match_id, inv.game); }
      else if (inv.status !== 'pending') { clearInterval(waiting); closeModal(); showToast(`${name} a refusé.`, 'info'); }
    }, 2000);
    el.querySelector('[data-x]').addEventListener('click', async () => { clearInterval(waiting); await sb().rpc('invite_cancel', { p_id: inviteId }); closeModal(); });
  }

  function goPlay(matchId, game) {
    showPage('multi');
    const c = document.getElementById('multi-content');
    Online.watch(c, matchId, game, () => GameHub.render());
  }

  // ── Invitations reçues ──
  async function pollInvites() {
    if (!online() || inviteShown) return;
    const { data } = await sb().rpc('invites_get');
    const inv = (data || []).find(i => i.direction === 'recue' && i.status === 'pending');
    if (!inv) return;
    inviteShown = inv.id;
    const el = modal(`<h3>${esc(inv.other_pseudo)} te défie</h3><p class="soc-empty">${GAME_NAMES[inv.game] || ''} · partie classée</p>
      <button class="btn-empire btn-empire-primary soc-wide" data-y>Accepter</button><button class="btn-empire btn-empire-secondary soc-wide" data-n>Refuser</button>`);
    const done = () => { inviteShown = null; closeModal(); };
    el.querySelector('[data-n]').addEventListener('click', async () => { await sb().rpc('invite_respond', { p_id: inv.id, p_accept: false }); done(); });
    el.querySelector('[data-y]').addEventListener('click', async () => {
      const { data: r, error } = await sb().rpc('invite_respond', { p_id: inv.id, p_accept: true });
      done();
      if (error) return showToast(msg(error), 'error');
      goPlay(r.match_id, inv.game);
    });
    setTimeout(() => { if (inviteShown === inv.id) done(); }, 110000);
  }

  // ── Clans ──
  async function renderClan() {
    const host = document.getElementById('prof-pane-clan');
    if (!host) return;
    if (!online()) { host.innerHTML = '<p class="soc-empty">Connecte-toi pour rejoindre un clan.</p>'; return; }
    const { data: mine } = await sb().rpc('clan_mine');
    const bar = `<div class="cat-tabs hub-tabs"><button class="cat-tab ${clanView === 'mon' ? 'active' : ''}" data-cv="mon">${mine ? 'Mon clan' : 'Rejoindre'}</button><button class="cat-tab ${clanView === 'top' ? 'active' : ''}" data-cv="top">Classement</button></div>`;
    let body = '';
    if (clanView === 'top') {
      const { data } = await sb().rpc('clan_search', { p_q: '' });
      body = clanRows(data || [], mine);
    } else if (mine) {
      body = clanMine(mine);
    } else {
      body = `
        <form class="soc-add" id="clan-create">
          <input class="game-input" id="cl-name" maxlength="24" placeholder="Nom du clan" />
          <input class="game-input soc-tag" id="cl-tag" maxlength="4" placeholder="TAG" />
          <button class="btn-empire btn-empire-primary" type="submit">Créer</button>
        </form>
        <p class="soc-msg hidden" id="soc-msg"></p>
        <form class="soc-add" id="clan-find"><input class="game-input" id="cl-q" maxlength="24" placeholder="Chercher un clan" /><button class="btn-empire btn-empire-secondary" type="submit">Chercher</button></form>
        <div id="clan-results">${clanRows((await sb().rpc('clan_search', { p_q: '' })).data || [], null)}</div>`;
    }
    host.innerHTML = bar + `<div class="soc-list">${body}</div>`;
    host.querySelectorAll('[data-cv]').forEach(b => b.addEventListener('click', () => { clanView = b.dataset.cv; renderClan(); }));
    bindClan(host, mine);
  }

  function clanRows(list, mine) {
    if (!list.length) return '<p class="soc-empty">Aucun clan pour l\'instant. Crée le premier.</p>';
    return list.map(c => `<div class="soc-row"><span class="soc-pos">${c.pos}</span><span class="soc-tagbadge">${esc(c.tag)}</span>
      <span class="soc-name"><strong>${esc(c.name)}</strong><em>${c.members}/30 membres · ${c.lp} PL${c.open ? '' : ' · fermé'}</em></span>
      ${!mine && c.open ? `<button class="btn-empire btn-empire-primary soc-btn" data-join="${c.id}">Rejoindre</button>` : ''}</div>`).join('');
  }

  function clanMine(c) {
    const total = c.members.reduce((a, m) => a + Number(m.lp), 0);
    return `
      <div class="soc-clan-head"><span class="soc-tagbadge soc-tagbadge-lg">${esc(c.tag)}</span>
        <div><strong>${esc(c.name)}</strong><em>${c.rank ? `n°${c.rank} · ` : ''}${c.members.length}/30 membres · ${total} PL cette saison</em></div></div>
      ${c.descr ? `<p class="soc-descr">${esc(c.descr)}</p>` : ''}
      ${c.me_leader ? `<form class="soc-add" id="clan-set"><input class="game-input" id="cl-descr" maxlength="140" placeholder="Description" value="${esc(c.descr)}" />
        <button class="btn-empire btn-empire-secondary" type="submit">OK</button>
        <button class="btn-empire btn-empire-secondary" type="button" id="cl-open">${c.open ? 'Ouvert' : 'Fermé'}</button></form>` : ''}
      <h4>Membres</h4>
      ${c.members.map(m => `<div class="soc-row">${avatar(m)}<span class="soc-name"><strong>${m.leader ? '★ ' : ''}${esc(m.pseudo)}</strong><em><i class="soc-dot ${m.online ? 'on' : ''}"></i>Niv. ${m.level} · ${m.lp} PL</em></span>
        ${c.me_leader && !m.leader ? `<button class="btn-empire btn-empire-secondary soc-btn" data-kick="${m.user_id}">Virer</button>` : ''}</div>`).join('')}
      <button class="btn-empire btn-empire-secondary soc-wide" id="clan-leave">Quitter le clan</button>`;
  }

  function bindClan(host, mine) {
    const note = (t) => { const m = host.querySelector('#soc-msg'); if (m) { m.textContent = t; m.className = 'soc-msg is-error'; } else GameDialog.alert(t); };
    host.querySelector('#clan-create')?.addEventListener('submit', async e => {
      e.preventDefault();
      const { error } = await sb().rpc('clan_create', { p_name: host.querySelector('#cl-name').value, p_tag: host.querySelector('#cl-tag').value, p_descr: '' });
      if (error) return note(msg(error));
      renderClan();
    });
    host.querySelector('#clan-find')?.addEventListener('submit', async e => {
      e.preventDefault();
      const { data } = await sb().rpc('clan_search', { p_q: host.querySelector('#cl-q').value });
      host.querySelector('#clan-results').innerHTML = clanRows(data || [], null);
      bindClan(host, mine);
    });
    host.querySelectorAll('[data-join]').forEach(b => b.addEventListener('click', async () => {
      const { error } = await sb().rpc('clan_join', { p_clan: b.dataset.join });
      if (error) return note(msg(error));
      renderClan();
    }));
    host.querySelector('#clan-leave')?.addEventListener('click', async () => {
      if (!(await GameDialog.confirm('Tu pourras en rejoindre un autre quand tu veux.', { title: 'Quitter le clan ?', ok: 'Quitter', danger: true }))) return;
      await sb().rpc('clan_leave'); clanView = 'mon'; renderClan();
    });
    host.querySelectorAll('[data-kick]').forEach(b => b.addEventListener('click', async () => {
      if (!(await GameDialog.confirm('Il ne fera plus partie du clan.', { title: 'Virer ce joueur ?', ok: 'Virer', danger: true }))) return;
      await sb().rpc('clan_kick', { p_user: b.dataset.kick }); renderClan();
    }));
    host.querySelector('#clan-set')?.addEventListener('submit', async e => {
      e.preventDefault();
      await sb().rpc('clan_set', { p_descr: host.querySelector('#cl-descr').value, p_open: mine.open }); renderClan();
    });
    host.querySelector('#cl-open')?.addEventListener('click', async () => {
      await sb().rpc('clan_set', { p_descr: mine.descr, p_open: !mine.open }); renderClan();
    });
  }

  // Appelé à l'ouverture de la page Profil
  function onProfileOpen() { start(); renderTabs(); }

  // Ouvre directement un onglet (amis, clan) depuis n'importe où
  function openTab(t) { tab = t; showPage('profil'); }

  return { start, onProfileOpen, openTab, refreshBadge };
})();

if (typeof window !== 'undefined') window.Social = Social;
