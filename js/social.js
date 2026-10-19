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
  let unread = { clan: 0, dm: {} };
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
    // (les appels Supabase ne partent que si on les « attend » : d'où le .then)
    sb().rpc('touch_presence').then(() => {});
    setInterval(() => { if (!document.hidden) { sb().rpc('touch_presence').then(() => {}); if (window.Account && Account.applyGrants) Account.applyGrants(); } }, 60000);
    setInterval(() => { if (!document.hidden) pollInvites(); }, 5000);
    setInterval(() => { if (!document.hidden) refreshBadge(); }, 30000);
    refreshBadge();
    document.getElementById('btn-friends-top')?.addEventListener('click', () => openTab('amis'));
    document.querySelectorAll('#prof-tabs [data-ptab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.ptab; renderTabs(); }));
  }

  async function refreshBadge() {
    if (!online()) return;
    const [{ data }, un] = await Promise.all([sb().rpc('friends_list'), sb().rpc('chat_unread')]);
    const requests = (data || []).filter(f => f.rel === 'recue').length;
    unread = (un && un.data) ? { clan: un.data.clan || 0, dm: un.data.dm || {} } : unread;
    const msgs = (unread.clan || 0) + Object.values(unread.dm).reduce((a, b) => a + (+b || 0), 0);
    const n = requests + msgs;
    const el1 = document.getElementById('badge-friends'), el2 = document.getElementById('top-friends-badge');
    if (el1) { el1.textContent = requests + Object.values(unread.dm).reduce((a, b) => a + (+b || 0), 0); el1.classList.toggle('hidden', !el1.textContent || el1.textContent === '0'); }
    if (el2) { el2.textContent = n; el2.classList.toggle('hidden', !n); }
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
    const un = await sb().rpc('chat_unread');
    if (un && un.data) unread = { clan: un.data.clan || 0, dm: un.data.dm || {} };
    const { data, error } = await sb().rpc('friends_list');
    if (error) { host.innerHTML = `<p class="soc-empty">${esc(msg(error))}</p>`; return; }
    const list = data || [];
    const received = list.filter(f => f.rel === 'recue'), friends = list.filter(f => f.rel === 'ami'), sent = list.filter(f => f.rel === 'envoyee');
    if (window.Achievements) Achievements.on('friends', { n: friends.length });
    const code = (Account.profile && Account.profile.friend_code) || '';
    const row = (f, actions) => `<div class="soc-row"><span class="soc-click" data-profile="${f.user_id}" role="button" tabindex="0">${avatar(f)}</span><span class="soc-name soc-click" data-profile="${f.user_id}" role="button" tabindex="0"><strong>${esc(f.pseudo)}</strong><em>${f.rel === 'ami' ? `<i class="soc-dot ${f.online ? 'on' : ''}"></i>${f.online ? 'En ligne' : 'Hors ligne'} · ` : ''}Niv. ${f.level}</em></span>${actions}</div>`;
    host.innerHTML = `
      <form class="soc-add" id="soc-add">
        <input class="game-input" id="soc-add-input" maxlength="24" placeholder="Pseudo ou code ami" autocomplete="off" />
        <button class="btn-empire btn-empire-primary" type="submit">Ajouter</button>
      </form>
      <p class="soc-msg hidden" id="soc-msg"></p>
      ${code ? `<p class="soc-code">Ton code ami : <strong>${esc(code)}</strong></p>` : ''}
      <div class="soc-list">
        <div id="trades"></div>
        ${received.length ? `<h4>Demandes reçues</h4>${received.map(f => row(f, `<button class="btn-empire btn-empire-primary soc-btn" data-accept="${f.user_id}">Accepter</button><button class="btn-empire btn-empire-secondary soc-btn" data-refuse="${f.user_id}">✕</button>`)).join('')}` : ''}
        <h4>Mes amis (${friends.length})</h4>
        ${friends.length ? friends.map(f => row(f, `<button class="btn-empire btn-empire-secondary soc-btn" data-msg="${f.user_id}" data-name="${esc(f.pseudo)}">Message${(unread.dm[f.user_id] || 0) ? ` <b class="chat-dot">${unread.dm[f.user_id]}</b>` : ''}</button><button class="btn-empire btn-empire-primary soc-btn" data-duel="${f.user_id}" data-name="${esc(f.pseudo)}">Défier</button><button class="btn-empire btn-empire-secondary soc-btn" data-del="${f.user_id}" aria-label="Retirer">✕</button>`)).join('') : '<p class="soc-empty">Personne pour l\'instant. Ajoute quelqu\'un avec son pseudo ou son code ami.</p>'}
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
    host.querySelectorAll('[data-msg]').forEach(b => b.addEventListener('click', () => Chat.open({ scope: 'dm', target: b.dataset.msg, title: b.dataset.name })));
    bindProfileLinks(host);
    loadTrades(host);
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
    const un = await sb().rpc('chat_unread');
    if (un && un.data) unread = { clan: un.data.clan || 0, dm: un.data.dm || {} };
    const { data: mine } = await sb().rpc('clan_mine');
    if (mine && window.Achievements) Achievements.on('clan');
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
      ${!mine ? (c.open ? `<button class="btn-empire btn-empire-primary soc-btn" data-join="${c.id}">Rejoindre</button>`
        : c.requested ? `<button class="btn-empire btn-empire-secondary soc-btn" data-req-cancel="${c.id}">Demande envoyée ✕</button>`
        : `<button class="btn-empire btn-empire-primary soc-btn" data-request="${c.id}">Demander</button>`) : ''}</div>`).join('');
  }

  const ROLE_LABEL = { chef: 'Chef', colead: 'Co-chef', ancien: 'Ancien', membre: '' };
  const RANK = { chef: 3, colead: 2, ancien: 1, membre: 0 };

  function clanMine(c) {
    const total = c.members.reduce((a, m) => a + Number(m.lp), 0);
    const me = c.me_role || (c.me_leader ? 'chef' : 'membre');
    const canSet = RANK[me] >= 2;
    const canManage = m => m.user_id !== (Account.user && Account.user.id) && (me === 'chef' || (me === 'colead' && RANK[m.role || 'membre'] < 2));
    return `
      <div class="soc-clan-head"><span class="soc-tagbadge soc-tagbadge-lg">${esc(c.tag)}</span>
        <div><strong>${esc(c.name)}</strong><em>${c.rank ? `n°${c.rank} · ` : ''}${c.members.length}/30 membres · ${total} PL cette saison</em></div></div>
      ${c.descr && !canSet ? `<p class="soc-descr">${esc(c.descr)}</p>` : ''}
      ${canSet ? `<form class="soc-add" id="clan-set"><input class="game-input" id="cl-descr" maxlength="140" placeholder="Description du clan" value="${esc(c.descr)}" />
        <button class="btn-empire btn-empire-secondary" type="submit">OK</button>
        <button class="btn-empire btn-empire-secondary" type="button" id="cl-open" title="Change qui peut entrer">${c.open ? 'Ouvert à tous' : 'Sur demande'}</button></form>` : ''}
      ${c.requests ? `<div id="clan-requests"><h4>Demandes pour rejoindre (${c.requests})</h4><p class="soc-empty">Chargement…</p></div>` : ''}
      <button class="btn-empire btn-empire-primary soc-wide" id="clan-chat" style="margin:0 0 8px">Discussion du clan${(unread.clan || 0) ? ` <b class="chat-dot">${unread.clan}</b>` : ''}</button>
      <h4>Membres</h4>
      ${c.members.map(m => { const r = m.role || (m.leader ? 'chef' : 'membre'); return `<div class="soc-row"><span class="soc-click" data-profile="${m.user_id}" role="button" tabindex="0">${avatar(m)}</span><span class="soc-name soc-click" data-profile="${m.user_id}" role="button" tabindex="0"><strong>${esc(m.pseudo)}</strong><em><i class="soc-dot ${m.online ? 'on' : ''}"></i>Niv. ${m.level} · ${m.lp} PL</em></span>
        ${ROLE_LABEL[r] ? `<span class="soc-role soc-role-${r}">${ROLE_LABEL[r]}</span>` : ''}
        ${canManage(m) ? `<button class="btn-empire btn-empire-secondary soc-btn" data-manage="${m.user_id}">Gérer</button>` : ''}</div>`; }).join('')}
      <button class="btn-empire btn-empire-secondary soc-wide" id="clan-leave">Quitter le clan</button>`;
  }

  // Gérer un membre : rôle, passer la main, exclure
  function openManage(c, m) {
    const me = c.me_role || (c.me_leader ? 'chef' : 'membre');
    const cur = m.role || 'membre';
    const roleBtn = (r, label) => me === 'chef' ? `<button class="btn-empire ${cur === r ? 'btn-empire-primary' : 'btn-empire-secondary'} soc-wide" data-role="${r}" ${cur === r ? 'disabled' : ''}>${label}${cur === r ? ' (actuel)' : ''}</button>` : '';
    const el = modal(`<h3>${esc(m.pseudo)}</h3><p class="soc-empty">${ROLE_LABEL[cur] || 'Membre'}</p>
      ${me === 'chef' ? '<p class="soc-empty">Rôle dans le clan</p>' : ''}
      ${roleBtn('membre', 'Membre')}${roleBtn('ancien', 'Ancien · traite les demandes')}${roleBtn('colead', 'Co-chef · gère le clan et exclut')}
      ${me === 'chef' ? '<button class="btn-empire btn-empire-secondary soc-wide" data-transfer>Passer la main (il devient chef)</button>' : ''}
      <button class="btn-empire btn-empire-secondary soc-wide" data-kick>Exclure du clan</button>
      <button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button>`);
    const done = () => { closeModal(); renderClan(); };
    const run = async (fn, args) => { const { error } = await sb().rpc(fn, args); if (error) { closeModal(); return GameDialog.alert(msg(error), { title: 'Impossible' }); } done(); };
    el.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => run('clan_set_role', { p_user: m.user_id, p_role: b.dataset.role })));
    el.querySelector('[data-transfer]')?.addEventListener('click', async () => {
      closeModal();
      if (await GameDialog.confirm(`${m.pseudo} devient le chef du clan et tu passes co-chef.`, { title: 'Passer la main ?', ok: 'Passer la main', danger: true })) run('clan_transfer', { p_user: m.user_id });
    });
    el.querySelector('[data-kick]').addEventListener('click', async () => {
      closeModal();
      if (await GameDialog.confirm('Il ne fera plus partie du clan.', { title: 'Exclure ce joueur ?', ok: 'Exclure', danger: true })) run('clan_kick', { p_user: m.user_id });
    });
    el.querySelector('[data-x]').addEventListener('click', closeModal);
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
    host.querySelectorAll('[data-request]').forEach(b => b.addEventListener('click', async () => {
      const { error } = await sb().rpc('clan_request', { p_clan: b.dataset.request });
      if (error) return note(msg(error));
      renderClan();
    }));
    host.querySelectorAll('[data-req-cancel]').forEach(b => b.addEventListener('click', async () => { await sb().rpc('clan_request_cancel', { p_clan: b.dataset.reqCancel }); renderClan(); }));
    bindProfileLinks(host);
    if (mine && mine.requests) loadClanRequests(host);
    host.querySelectorAll('[data-manage]').forEach(b => b.addEventListener('click', () => openManage(mine, mine.members.find(x => x.user_id === b.dataset.manage))));
    host.querySelector('#clan-chat')?.addEventListener('click', () => Chat.open({ scope: 'clan', title: 'Clan ' + (mine ? mine.name : '') }));
    host.querySelector('#clan-leave')?.addEventListener('click', async () => {
      if (!(await GameDialog.confirm('Tu pourras en rejoindre un autre quand tu veux.', { title: 'Quitter le clan ?', ok: 'Quitter', danger: true }))) return;
      await sb().rpc('clan_leave'); clanView = 'mon'; renderClan();
    });
    host.querySelector('#clan-set')?.addEventListener('submit', async e => {
      e.preventDefault();
      await sb().rpc('clan_set', { p_descr: host.querySelector('#cl-descr').value, p_open: mine.open }); renderClan();
    });
    host.querySelector('#cl-open')?.addEventListener('click', async () => {
      await sb().rpc('clan_set', { p_descr: mine.descr, p_open: !mine.open }); renderClan();
    });
  }

  async function loadClanRequests(host) {
    const box = host.querySelector('#clan-requests'); if (!box) return;
    const { data } = await sb().rpc('clan_requests_list');
    const list = data || [];
    box.innerHTML = `<h4>Demandes pour rejoindre (${list.length})</h4>` + (list.length ? list.map(r => `<div class="soc-row"><span class="soc-click" data-profile="${r.user_id}">${avatar(r)}</span><span class="soc-name soc-click" data-profile="${r.user_id}"><strong>${esc(r.pseudo)}</strong><em>Niv. ${r.level}</em></span>
      <button class="btn-empire btn-empire-primary soc-btn" data-accept-req="${r.user_id}">Accepter</button><button class="btn-empire btn-empire-secondary soc-btn" data-refuse-req="${r.user_id}">✕</button></div>`).join('') : '<p class="soc-empty">Aucune demande.</p>');
    box.querySelectorAll('[data-accept-req]').forEach(b => b.addEventListener('click', async () => { const { error } = await sb().rpc('clan_respond', { p_user: b.dataset.acceptReq, p_accept: true }); if (error) GameDialog.alert(msg(error), { title: 'Impossible' }); renderClan(); }));
    box.querySelectorAll('[data-refuse-req]').forEach(b => b.addEventListener('click', async () => { await sb().rpc('clan_respond', { p_user: b.dataset.refuseReq, p_accept: false }); renderClan(); }));
    bindProfileLinks(box);
  }

  // ── Échanges de cartes entre amis ──
  async function loadTrades(host) {
    const box = host.querySelector('#trades'); if (!box) return;
    const { data } = await sb().rpc('trade_list');
    const list = data || [];
    if (!list.length) { box.innerHTML = ''; return; }
    const nm = id => { const it = getEmpireItemById(id); return it ? esc(it.name) : 'Carte'; };
    box.innerHTML = `<h4>Échanges en cours (${list.length})</h4>` + list.map(t => `<div class="soc-row soc-trade">
      <span class="soc-name"><strong>${t.mine ? `Pour ${esc(t.other)}` : `De ${esc(t.other)}`}</strong>
        <em>${t.mine ? 'Tu donnes' : 'Il te donne'} « ${nm(t.give)} » · ${t.mine ? 'tu veux' : 'il veut'} « ${nm(t.want)} »</em></span>
      ${t.mine ? `<button class="btn-empire btn-empire-secondary soc-btn" data-t-cancel="${t.id}">Annuler</button>`
        : `<button class="btn-empire btn-empire-primary soc-btn" data-t-ok="${t.id}" data-want="${esc(t.want)}">Accepter</button><button class="btn-empire btn-empire-secondary soc-btn" data-t-no="${t.id}">✕</button>`}</div>`).join('');
    const refresh = () => { loadTrades(host); };
    box.querySelectorAll('[data-t-cancel]').forEach(b => b.addEventListener('click', async () => {
      const { data: card, error } = await sb().rpc('trade_cancel', { p_id: b.dataset.tCancel });
      if (error) { GameDialog.alert(msg(error), { title: 'Impossible' }); return refresh(); }
      EmpireManager.giveCard(card);
      if (window.Account && Account.push) Account.push();
      showToast('Échange annulé, ta carte est revenue.', 'info'); refresh();
    }));
    box.querySelectorAll('[data-t-no]').forEach(b => b.addEventListener('click', async () => {
      const { error } = await sb().rpc('trade_decline', { p_id: b.dataset.tNo });
      if (error) GameDialog.alert(msg(error), { title: 'Impossible' }); refresh();
    }));
    box.querySelectorAll('[data-t-ok]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      if (!(EmpireManager.getInventory()[b.dataset.want] > 0)) { b.disabled = false; return GameDialog.alert('Tu n\'as pas la carte demandée.', { title: 'Échange impossible' }); }
      if (window.Account && Account.push) await Account.push();
      const { data: r, error } = await sb().rpc('trade_accept', { p_id: b.dataset.tOk });
      if (error) { b.disabled = false; GameDialog.alert(msg(error), { title: 'Impossible' }); return refresh(); }
      EmpireManager.takeCard(r.give); EmpireManager.giveCard(r.get);
      if (window.Account && Account.push) Account.push();
      showToast('Échange fait : la carte est dans ta collection.', 'gold'); refresh();
    }));
  }

  function openTradeEditor(friendId, friendName) {
    const inv = EmpireManager.getInventory();
    const owned = Object.keys(inv).filter(id => inv[id] > 0).map(id => getEmpireItemById(id)).filter(Boolean).sort((a, b) => (b.value || 0) - (a.value || 0));
    const all = (typeof getAllBaseItemsList === 'function') ? getAllBaseItemsList() : [];
    let give = null, want = null;
    const el = modal(`
      <h3>Échange avec ${esc(friendName)}</h3>
      <p class="soc-empty">Ta carte est mise de côté en attendant sa réponse (7 jours max).</p>
      <div class="tr-pick"><div><strong>Tu donnes</strong><div class="tr-slot" id="tr-give">—</div></div><div><strong>Tu veux</strong><div class="tr-slot" id="tr-want">—</div></div></div>
      <div class="cat-tabs hub-tabs"><button class="cat-tab active" data-tt="give">Ma carte</button><button class="cat-tab" data-tt="want">Sa carte</button></div>
      <input class="game-input sc-search" placeholder="Chercher une carte" />
      <div class="sc-list"></div>
      <p class="soc-msg is-error hidden" id="tr-err"></p>
      <div class="dlg-actions"><button class="btn-empire btn-empire-secondary" data-x>Annuler</button><button class="btn-empire btn-empire-primary" data-send disabled>Proposer</button></div>`);
    el.querySelector('.soc-modal-card').classList.add('pp-card');
    let mode = 'give';
    const slot = (id, it) => { el.querySelector(id).innerHTML = it ? tile(it.id, true) + `<span class="tr-name">${esc(it.name)}</span>` : '—'; };
    const list = () => {
      const q = el.querySelector('.sc-search').value.trim().toLowerCase();
      let rows;
      if (mode === 'give') rows = owned.filter(o => !q || o.name.toLowerCase().includes(q)).slice(0, 40);
      else rows = q.length < 2 ? [] : all.filter(o => o.name.toLowerCase().includes(q)).slice(0, 40);
      const chosen = mode === 'give' ? give : want;
      el.querySelector('.sc-list').innerHTML = rows.map(o => `<button type="button" class="sc-opt ${chosen && chosen.id === o.id ? 'is-on' : ''}" data-id="${esc(o.id)}">${tile(o.id, true)}<span><strong>${esc(o.name)}</strong><em>${esc(o.rarity)}</em></span></button>`).join('')
        || `<p class="soc-empty">${mode === 'want' ? 'Tape au moins 2 lettres du nom de la carte.' : 'Aucune carte.'}</p>`;
      el.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => {
        const it = getEmpireItemById(b.dataset.id);
        if (mode === 'give') { give = it; slot('#tr-give', it); } else { want = it; slot('#tr-want', it); }
        el.querySelector('[data-send]').disabled = !(give && want);
        list();
      }));
    };
    el.querySelectorAll('[data-tt]').forEach(b => b.addEventListener('click', () => {
      mode = b.dataset.tt; el.querySelectorAll('[data-tt]').forEach(x => x.classList.toggle('active', x === b)); el.querySelector('.sc-search').value = ''; list();
    }));
    el.querySelector('.sc-search').addEventListener('input', list);
    list();
    el.querySelector('[data-x]').addEventListener('click', closeModal);
    el.querySelector('[data-send]').addEventListener('click', async () => {
      const err = el.querySelector('#tr-err'); err.classList.add('hidden');
      const btn = el.querySelector('[data-send]'); btn.disabled = true;
      if (window.Account && Account.push) await Account.push();     // le serveur vérifie que la carte est bien dans ta sauvegarde
      const { error } = await sb().rpc('trade_propose', { p_to: friendId, p_give: give.id, p_want: want.id });
      if (error) { btn.disabled = false; err.textContent = msg(error); err.classList.remove('hidden'); return; }
      EmpireManager.takeCard(give.id);
      if (window.Account && Account.push) Account.push();
      closeModal(); showToast(`Proposition envoyée à ${friendName}.`, 'success');
      if (tab === 'amis') renderFriends();
    });
  }

  // ── Profil public ──
  const GAME_LABEL = { ut: 'Ultimate Comptoir', bataille: 'Bataille', des421: '421', pbc: 'Pierre-Briquet-Clope', quiz: 'Quiz', course: 'Course' };
  function tile(id, small) {
    const it = (typeof getEmpireItemById === 'function') ? getEmpireItemById(id) : null;
    if (!it) return '';
    const img = (typeof CardsRenderer !== 'undefined') ? CardsRenderer.resolveCardPhoto(it) : '';
    return `<div class="sc-tile rv-r-${esc(it.rarity)} ${small ? 'is-small' : ''}" title="${esc(it.name)}"><span class="sc-img"><img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()"></span><span class="sc-name">${esc(it.name)}</span></div>`;
  }
  function bindProfileLinks(host) {
    host.querySelectorAll('[data-profile]').forEach(el => {
      el.addEventListener('click', () => openProfile(el.dataset.profile));
      el.addEventListener('keydown', e => { if (e.key === 'Enter') openProfile(el.dataset.profile); });
    });
  }

  async function openProfile(id) {
    if (!online() || !id) return;
    const { data: p, error } = await sb().rpc('player_profile', { p_id: id });
    if (error || !p) return GameDialog.alert(msg(error), { title: 'Profil introuvable' });
    const av = p.avatar && /^data:image\//.test(p.avatar) ? `<img class="pp-avatar" src="${esc(p.avatar)}" alt="">` : `<span class="pp-avatar pp-avatar-letter">${esc((p.pseudo || '?').slice(0, 1).toUpperCase())}</span>`;
    const ratings = (p.ratings || []).map(r => {
      const rk = (typeof League !== 'undefined') ? League.rankFromLp(r.lp) : { name: r.lp + ' PL', index: 0 };
      return `<div class="pp-rank"><span>${esc(GAME_LABEL[r.game] || r.game)}</span><strong>${esc(rk.name)}</strong><em>${r.wins} V · ${r.losses} D</em></div>`;
    }).join('');
    const since = new Date(p.since).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const el = modal(`
      <div class="pp-head">${av}<div class="pp-id"><h3>${esc(p.pseudo)}</h3>${p.title ? `<p class="pp-title">${esc(p.title)}</p>` : ''}
        <p><i class="soc-dot ${p.online ? 'on' : ''}"></i>${p.online ? 'En ligne' : 'Hors ligne'} · Niv. ${p.level} · ${p.cards} cartes</p>
        ${p.clan ? `<p><span class="soc-tagbadge">${esc(p.clan.tag)}</span> ${esc(p.clan.name)}</p>` : ''}<p class="pp-since">Joue depuis ${esc(since)}</p></div></div>
      ${p.bio ? `<p class="pp-bio"></p>` : ''}
      ${(p.badges || []).length && window.Achievements ? `<div class="ach-chips">${p.badges.map(b => Achievements.badgeHtml(b)).join('')}</div>` : ''}
      ${(p.showcase || []).length ? `<h4>Vitrine</h4><div class="sc-row">${p.showcase.map(c => tile(c)).join('')}</div>` : (p.rel === 'self' ? '<p class="soc-empty">Ta vitrine est vide : choisis jusqu\'à 6 cartes à montrer.</p>' : '')}
      ${ratings ? `<h4>Rangs de la saison</h4><div class="pp-ranks">${ratings}</div>` : ''}
      <div class="pp-actions"></div>
      <button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button>`);
    el.querySelector('.soc-modal-card').classList.add('pp-card');
    const bio = el.querySelector('.pp-bio'); if (bio) bio.textContent = p.bio;
    const act = el.querySelector('.pp-actions');
    const mate = p.rel !== 'self' && !!p.clan && await sb().rpc('clan_mine').then(r => !!(r.data && r.data.members.some(x => x.user_id === p.id)));
    const add = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn-empire ' + cls + ' soc-wide'; b.textContent = label; b.addEventListener('click', fn); act.appendChild(b); };
    if (p.rel === 'self') add('Modifier ma vitrine', 'btn-empire-primary', () => { closeModal(); openShowcaseEditor(p); });
    else if (p.rel === 'ami') {
      add('Envoyer un message', 'btn-empire-primary', () => { closeModal(); Chat.open({ scope: 'dm', target: p.id, title: p.pseudo }); });
      add('Défier', 'btn-empire-secondary', () => { closeModal(); chooseGame(p.id, p.pseudo); });
      add('Proposer un échange de cartes', 'btn-empire-secondary', () => { closeModal(); openTradeEditor(p.id, p.pseudo, p.showcase || []); });
    } else if (p.rel === 'aucune') {
      if (mate) add('Défier (même clan)', 'btn-empire-secondary', () => { closeModal(); chooseGame(p.id, p.pseudo); });
      add('Ajouter en ami', 'btn-empire-primary', async () => {
        const { error: e2, data } = await sb().rpc('friend_request', { p_who: p.friend_code });
        closeModal();
        if (e2) return GameDialog.alert(msg(e2), { title: 'Demande impossible' });
        showToast(data && data.status === 'accepted' ? 'Vous êtes maintenant amis.' : 'Demande d\'ami envoyée.', 'success');
        refreshBadge();
      });
    } else if (p.rel === 'envoyee') { const b = document.createElement('p'); b.className = 'soc-empty'; b.textContent = 'Demande d\'ami envoyée.'; act.appendChild(b); }
    else if (p.rel === 'recue') add('Accepter sa demande d\'ami', 'btn-empire-primary', async () => { await sb().rpc('friend_respond', { p_other: p.id, p_accept: true }); closeModal(); showToast('Vous êtes amis.', 'success'); refreshBadge(); });
    el.querySelector('[data-x]').addEventListener('click', closeModal);
  }

  // ── Ma vitrine (présentation + 6 cartes) ──
  async function renderMyShowcase() {
    const host = document.getElementById('prof-showcase');
    if (!host || !online()) return;
    const { data: p } = await sb().rpc('player_profile', { p_id: Account.user.id });
    if (!p) return;
    host.innerHTML = `<div class="sc-head"><strong>Ma vitrine</strong><button class="btn-empire btn-empire-secondary soc-btn" id="sc-edit">Modifier</button></div>
      <p class="sc-bio"></p>
      ${(p.showcase || []).length ? `<div class="sc-row">${p.showcase.map(c => tile(c)).join('')}</div>` : '<p class="soc-empty">Montre tes plus belles cartes aux autres joueurs : touche « Modifier ».</p>'}`;
    host.querySelector('.sc-bio').textContent = p.bio || '';
    host.querySelector('#sc-edit').addEventListener('click', () => openShowcaseEditor(p));
  }

  function openShowcaseEditor(p) {
    const inv = (typeof EmpireManager !== 'undefined' && EmpireManager.getInventory) ? EmpireManager.getInventory() : {};
    const owned = Object.keys(inv).filter(id => (inv[id] || 0) > 0).map(id => getEmpireItemById(id)).filter(Boolean).sort((a, b) => (b.value || 0) - (a.value || 0));
    let chosen = (p.showcase || []).filter(id => owned.some(o => o.id === id));
    const el = modal(`
      <h3>Ma vitrine</h3>
      <textarea class="game-input sc-bio-in" maxlength="140" rows="2" placeholder="Une phrase pour te présenter (140 caractères)"></textarea>
      <div class="sc-count"></div>
      <div class="sc-row sc-chosen"></div>
      <input class="game-input sc-search" placeholder="Chercher dans mes cartes" />
      <div class="sc-list"></div>
      <p class="soc-msg is-error hidden" id="sc-err"></p>
      <div class="dlg-actions"><button class="btn-empire btn-empire-secondary" data-x>Annuler</button><button class="btn-empire btn-empire-primary" data-save>Enregistrer</button></div>`);
    el.querySelector('.soc-modal-card').classList.add('pp-card');
    const bio = el.querySelector('.sc-bio-in'); bio.value = p.bio || '';
    const draw = () => {
      el.querySelector('.sc-count').textContent = `${chosen.length}/6 cartes dans la vitrine`;
      el.querySelector('.sc-chosen').innerHTML = chosen.map(id => `<button type="button" class="sc-pick" data-rm="${esc(id)}">${tile(id, true)}</button>`).join('');
      el.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { chosen = chosen.filter(x => x !== b.dataset.rm); draw(); list(); }));
    };
    const list = () => {
      const q = el.querySelector('.sc-search').value.trim().toLowerCase();
      const rows = owned.filter(o => !q || o.name.toLowerCase().includes(q)).slice(0, 40);
      el.querySelector('.sc-list').innerHTML = rows.map(o => `<button type="button" class="sc-opt ${chosen.includes(o.id) ? 'is-on' : ''}" data-add="${esc(o.id)}">${tile(o.id, true)}<span><strong>${esc(o.name)}</strong><em>${esc(o.rarity)}</em></span></button>`).join('') || '<p class="soc-empty">Aucune carte.</p>';
      el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.add;
        if (chosen.includes(id)) chosen = chosen.filter(x => x !== id); else if (chosen.length < 6) chosen.push(id);
        draw(); list();
      }));
    };
    el.querySelector('.sc-search').addEventListener('input', list);
    draw(); list();
    el.querySelector('[data-x]').addEventListener('click', closeModal);
    el.querySelector('[data-save]').addEventListener('click', async () => {
      const err = el.querySelector('#sc-err'); err.classList.add('hidden');
      if (window.Account && Account.push) await Account.push();     // le serveur vérifie que tu possèdes ces cartes
      const { error } = await sb().rpc('profile_customize', { p_bio: bio.value, p_showcase: chosen });
      if (error) { err.textContent = msg(error); err.classList.remove('hidden'); return; }
      closeModal(); showToast('Vitrine enregistrée.', 'success'); renderMyShowcase();
    });
  }

  // Appelé à l'ouverture de la page Profil
  function onProfileOpen() {
    start(); renderTabs(); renderMyShowcase();
    if (window.Achievements) { Achievements.renderProfile(document.getElementById('prof-ach')); const t = document.getElementById('prof-title'); if (t) t.textContent = Achievements.title(); }
  }

  // Ouvre directement un onglet (amis, clan) depuis n'importe où
  function openTab(t) { tab = t; showPage('profil'); }

  return { start, onProfileOpen, openTab, refreshBadge, openProfile };
})();

if (typeof window !== 'undefined') window.Social = Social;
