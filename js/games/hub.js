// ============================================================
// THE ASHTRAY KING — Salle de jeux
// Les mini-jeux classés, les défis de la semaine et la vitrine des prestiges.
// ============================================================

const GameHub = (() => {
  const GAMES = [
    { id: 'ut',       name: 'Ultimate Comptoir',    desc: 'Ton onze de légende, tes liens, ta cohésion. Un match pour tout prouver.', engine: () => UltimateTeam, art: 'pitch' },
    { id: 'bataille', name: 'Bataille de Comptoir', desc: 'Tes cartes contre les siennes, stat par stat.', engine: () => Bataille, art: 'cards' },
    { id: 'des421',   name: '421',                  desc: 'Trois dés, trois lancers, une seule combinaison.', engine: () => Des421, art: 'dice' },
    { id: 'pbc',      name: 'Pierre-Briquet-Clope', desc: 'Le shifumi du comptoir. L\'ordi lit tes habitudes.', engine: () => PBC, art: 'pbc' },
    { id: 'quiz',     name: 'Quiz du Comptoir',     desc: 'Une photo, quatre noms, huit secondes. Plus vite que l\'ordi ?', engine: () => QuizComptoir, art: 'quiz' },
    { id: 'course',   name: 'Course Clandestine',   desc: 'Quatre fumeurs, un trottoir, un seul vainqueur.', engine: () => CourseClandestine, art: 'race' },
  ];
  let view = 'home';          // home | prestiges | rangs
  let prestigeTab = 'semaine';
  let countdownTimer = null;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function container() { return document.getElementById('multi-content'); }

  function fmtCountdown(ms) {
    const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
    return d > 0 ? `${d} j ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
  }

  const ART = {
    quiz: `<svg viewBox="0 0 80 60"><rect x="8" y="8" width="40" height="44" rx="5" fill="#f6e9cc" stroke="#120a04" stroke-width="3"/><rect x="14" y="14" width="28" height="24" rx="3" fill="#9cc8ff" stroke="#120a04" stroke-width="2"/><circle cx="62" cy="24" r="13" fill="#ffc43a" stroke="#120a04" stroke-width="3"/><text x="62" y="31" text-anchor="middle" font-family="Cendrier, sans-serif" font-size="19" fill="#120a04">?</text><path d="M14 44h28" stroke="#120a04" stroke-width="3" stroke-linecap="round"/></svg>`,
    pitch: `<svg viewBox="0 0 80 60"><rect x="4" y="4" width="72" height="52" rx="4" fill="#1f7a4a" stroke="#120a04" stroke-width="3"/><path d="M40 4v52M4 22h10v16H4M76 22H66v16h10" fill="none" stroke="#f6e9cc" stroke-width="2"/><circle cx="40" cy="30" r="8" fill="none" stroke="#f6e9cc" stroke-width="2"/><path d="M22 18L34 30M22 42L34 30M46 30L58 18M46 30L58 42" stroke="#3fcf7a" stroke-width="2.5"/><g fill="#ffc43a" stroke="#120a04" stroke-width="2"><circle cx="22" cy="18" r="4"/><circle cx="22" cy="42" r="4"/><circle cx="58" cy="18" r="4"/><circle cx="58" cy="42" r="4"/></g></svg>`,
    cards: `<svg viewBox="0 0 80 60"><rect x="14" y="10" width="28" height="40" rx="4" fill="#f6e9cc" stroke="#120a04" stroke-width="3" transform="rotate(-12 28 30)"/><rect x="38" y="8" width="28" height="40" rx="4" fill="#ffc43a" stroke="#120a04" stroke-width="3" transform="rotate(10 52 28)"/><path d="M47 22l5 9-5 9-5-9z" fill="#e2322b" stroke="#120a04" stroke-width="2" transform="rotate(10 52 28)"/></svg>`,
    dice: `<svg viewBox="0 0 80 60"><rect x="8" y="16" width="26" height="26" rx="5" fill="#fbf0d8" stroke="#120a04" stroke-width="3" transform="rotate(-10 21 29)"/><circle cx="15" cy="23" r="2.6" fill="#120a04"/><circle cx="27" cy="34" r="2.6" fill="#120a04"/><rect x="44" y="10" width="26" height="26" rx="5" fill="#fbf0d8" stroke="#120a04" stroke-width="3" transform="rotate(12 57 23)"/><circle cx="57" cy="23" r="3" fill="#e2322b"/><rect x="34" y="32" width="22" height="22" rx="5" fill="#fbf0d8" stroke="#120a04" stroke-width="3"/><circle cx="40" cy="38" r="2.3" fill="#120a04"/><circle cx="50" cy="48" r="2.3" fill="#120a04"/></svg>`,
    pbc: `<svg viewBox="0 0 80 60"><path d="M6 44c-3-6 1-14 9-16 4-6 13-6 17 0 6 2 8 9 5 15-1 6-8 9-16 8-7 1-13-1-15-7z" fill="#9b948a" stroke="#120a04" stroke-width="3"/><rect x="40" y="22" width="16" height="22" rx="3" fill="#e2322b" stroke="#120a04" stroke-width="3"/><path d="M48 8c4 4 4 7 0 9-4-2-4-5 0-9z" fill="#ffc43a" stroke="#120a04" stroke-width="2"/><g transform="rotate(-30 66 40)"><rect x="56" y="36" width="22" height="7" rx="1" fill="#fbf0d8" stroke="#120a04" stroke-width="2.5"/><rect x="56" y="36" width="7" height="7" fill="#ff9d1c" stroke="#120a04" stroke-width="2.5"/></g></svg>`,
    race: `<svg viewBox="0 0 80 60"><path d="M4 50h72" stroke="#120a04" stroke-width="3"/><path d="M8 50l10-30h44l10 30" fill="#1f7a4a" stroke="#120a04" stroke-width="3" stroke-linejoin="round"/><path d="M40 20v30M26 20l-6 30M54 20l6 30" stroke="#f6e9cc" stroke-width="2" stroke-dasharray="4 4"/><rect x="58" y="6" width="3" height="16" fill="#120a04"/><path d="M61 6h12l-3 4 3 4H61z" fill="#f6e9cc" stroke="#120a04" stroke-width="2"/></svg>`,
  };

  function render() {
    const c = container();
    if (!c) return;
    clearInterval(countdownTimer);
    if (window.Online) Online.stopAll();
    if (view === 'prestiges') return renderPrestiges(c);
    if (view === 'rangs') return renderRanks(c);
    if (view === 'classements') return renderBoards(c);

    const weekly = Prestige.weekly();
    const done = weekly.filter(w => w.done).length;
    const counts = Prestige.counts();
    c.innerHTML = `
      <div class="hub">
        <button class="hub-week" data-view="prestiges">
          <div class="hub-week-top">
            <span class="hub-week-title">Défis de la semaine</span>
            <span class="hub-week-reset" id="hub-reset">Reset dans ${fmtCountdown(Prestige.msUntilReset())}</span>
          </div>
          <div class="hub-week-bar"><div style="width:${done * 10}%"></div></div>
          <div class="hub-week-bottom">
            <span><strong>${done}/10</strong> réussis</span>
            <span class="hub-trophy-counts">
              ${['platine', 'or', 'argent', 'bronze'].map(t => `<span>${Prestige.trophyIcon(t, 18)}${counts[t] || 0}</span>`).join('')}
            </span>
          </div>
        </button>

        <div class="hub-games">
          ${GAMES.map(g => {
            const r = League.getRank(g.id);
            const s = League.stats(g.id);
            const top = r.index === League.RANKS.length - 1;
            return `
              <button class="hub-game" data-game="${g.id}">
                <span class="hub-game-art">${ART[g.art]}</span>
                <span class="hub-game-info">
                  <strong>${g.name}<span class="hub-help" role="button" tabindex="0" data-help="${g.id}" aria-label="Règles">?</span></strong>
                  <span class="hub-game-desc">${g.desc}</span>
                  <span class="hub-game-rank">${League.badge(r.index, 'sm')}<span>${r.name}</span><em>${s.wins} V · ${s.losses} D</em></span>
                  <span class="hub-game-lp"><span style="width:${top ? 100 : r.inRank}%"></span></span>
                </span>
              </button>`;
          }).join('')}
        </div>

        <div class="hub-footer">
          <button class="btn-empire btn-empire-secondary" data-view="classements">Classements</button>
          <button class="btn-empire btn-empire-primary" data-friends>Jouer avec des amis</button>
          <button class="btn-empire btn-empire-secondary" data-view="rangs">Les 26 rangs</button>
          <button class="btn-empire btn-empire-secondary" data-legacy>Duels de cartes</button>
        </div>
        <p class="hub-note">Classements remis à zéro chaque mois (saison ${League.seasonLabel()}). Baron, Parrain et Roi du Comptoir : uniquement en battant de vrais joueurs.</p>
      </div>`;

    c.querySelectorAll('[data-game]').forEach(b => b.addEventListener('click', (e) => {
      if (e.target.closest('[data-help]')) return;
      openGame(b.dataset.game);
    }));
    c.querySelectorAll('[data-help]').forEach(h => h.addEventListener('click', (e) => {
      e.stopPropagation();
      GameUI.showRules(h.dataset.help);
    }));
    c.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; render(); }));
    c.querySelector('[data-legacy]')?.addEventListener('click', openLegacy);
    c.querySelector('[data-friends]')?.addEventListener('click', () => window.Social && Social.openTab('amis'));
    countdownTimer = setInterval(() => {
      const el = document.getElementById('hub-reset');
      if (!el) return clearInterval(countdownTimer);
      el.textContent = `Reset dans ${fmtCountdown(Prestige.msUntilReset())}`;
    }, 30000);
  }

  function openGame(id, silent) {
    const g = GAMES.find(x => x.id === id);
    const c = container();
    if (!g || !c) return;
    view = 'home';
    if (silent) {
      // Retour de course : on réaffiche l'écran du jeu sans relancer de partie
      if (!c.querySelector('.mg-screen')) g.engine().start(c);
      return;
    }
    if (window.Online && Online.GAME_IDS.includes(id)) Online.chooser(c, id, () => g.engine().start(c));
    else g.engine().start(c);
    // Première partie : on explique les règles
    try {
      if (!localStorage.getItem('rules_seen_' + id)) {
        localStorage.setItem('rules_seen_' + id, '1');
        GameUI.showRules(id);
      }
    } catch (e) {}
  }

  function openLegacy() {
    if (typeof MultiplayerEngine === 'undefined') return;
    MultiplayerEngine.render();
    const c = container();
    const back = document.createElement('button');
    back.className = 'btn-empire btn-empire-secondary hub-legacy-back';
    back.textContent = '‹ Salle de jeux';
    back.addEventListener('click', () => { view = 'home'; render(); });
    c.prepend(back);
  }

  function renderPrestiges(c) {
    const weekly = Prestige.weekly();
    const trophies = Prestige.trophies();
    const counts = Prestige.counts();
    c.innerHTML = `
      <div class="hub hub-prestiges">
        <div class="mg-header">
          <button class="mg-back" data-home aria-label="Retour">‹</button>
          <div class="mg-header-title"><strong>Prestiges</strong><span>Du lundi au dimanche · reset dans ${fmtCountdown(Prestige.msUntilReset())}</span></div>
        </div>
        <div class="cat-tabs hub-tabs">
          <button class="cat-tab ${prestigeTab === 'semaine' ? 'active' : ''}" data-ptab="semaine">Cette semaine</button>
          <button class="cat-tab ${prestigeTab === 'vitrine' ? 'active' : ''}" data-ptab="vitrine">Ma vitrine (${trophies.length})</button>
        </div>
        ${prestigeTab === 'semaine' ? `
          <div class="pr-list">
            ${weekly.map(w => `
              <div class="pr-item ${w.done ? 'is-done' : ''} pr-${w.tier}">
                ${Prestige.trophyIcon(w.tier, 30)}
                <div class="pr-item-body">
                  <strong>${w.text}</strong>
                  <div class="pr-bar"><div style="width:${Math.round(w.progress / w.target * 100)}%"></div></div>
                  <span class="pr-meta">${w.done ? 'Réussi' : `${w.progress.toLocaleString('fr-FR')} / ${w.target.toLocaleString('fr-FR')}`} · ${w.reward.name} · +${w.reward.xp} XP${w.reward.packs ? ` · +${w.reward.packs} paquet${w.reward.packs > 1 ? 's' : ''}` : ''}</span>
                </div>
              </div>`).join('')}
            <div class="pr-item pr-platine ${weekly.every(w => w.done) ? 'is-done' : ''}">
              ${Prestige.trophyIcon('platine', 30)}
              <div class="pr-item-body">
                <strong>Platine de la semaine</strong>
                <span class="pr-meta">Réussis les 10 défis · +${Prestige.TROPHY.platine.xp} XP</span>
              </div>
            </div>
          </div>` : `
          <div class="pr-counts">
            ${['platine', 'or', 'argent', 'bronze'].map(t => `<div class="pr-count pr-${t}">${Prestige.trophyIcon(t, 34)}<strong>${counts[t] || 0}</strong><span>${Prestige.TROPHY[t].name}</span></div>`).join('')}
          </div>
          <div class="pr-list">
            ${trophies.length ? trophies.map(t => `
              <div class="pr-item is-done pr-${t.tier}">
                ${Prestige.trophyIcon(t.tier, 26)}
                <div class="pr-item-body"><strong>${t.name}</strong><span class="pr-meta">${t.detail} · ${new Date(t.at).toLocaleDateString('fr-FR')}</span></div>
              </div>`).join('') : '<p class="hub-note">Aucun prestige pour l\'instant. Les défis de la semaine t\'attendent !</p>'}
          </div>`}
      </div>`;
    c.querySelector('[data-home]').addEventListener('click', () => { view = 'home'; render(); });
    c.querySelectorAll('[data-ptab]').forEach(b => b.addEventListener('click', () => { prestigeTab = b.dataset.ptab; render(); }));
  }

  // ── Classements en ligne ───────────────────────────────────
  let boardTab = 'all';
  async function renderBoards(c) {
    const tabs = [['all', 'Général'], ...GAMES.map(g => [g.id, g.name]), ['collectors', 'Collection']];
    c.innerHTML = `
      <div class="hub hub-boards">
        <div class="mg-header">
          <button class="mg-back" data-home aria-label="Retour">‹</button>
          <div class="mg-header-title"><strong>Classements</strong><span>Saison ${League.seasonLabel()} · remise à zéro le 1er du mois</span></div>
        </div>
        <div class="cat-tabs hub-tabs">${tabs.map(([id, name]) => `<button class="cat-tab ${boardTab === id ? 'active' : ''}" data-btab="${id}">${name}</button>`).join('')}</div>
        <div class="bd-list" id="bd-list"><p class="hub-note">Chargement…</p></div>
      </div>`;
    c.querySelector('[data-home]').addEventListener('click', () => { view = 'home'; render(); });
    c.querySelectorAll('[data-btab]').forEach(b => b.addEventListener('click', () => { boardTab = b.dataset.btab; renderBoards(c); }));

    const sb = window.sb;
    const list = c.querySelector('#bd-list');
    if (!sb) { list.innerHTML = '<p class="hub-note">Classements indisponibles hors connexion.</p>'; return; }
    const meId = window.Account && Account.user && Account.user.id;
    let res;
    if (boardTab === 'all') res = await sb.rpc('get_overall_leaderboard', { p_limit: 50 });
    else if (boardTab === 'collectors') res = await sb.rpc('get_collectors', { p_limit: 50 });
    else res = await sb.rpc('get_leaderboard', { p_game: boardTab, p_limit: 50 });
    if (res.error) { list.innerHTML = `<p class="hub-note">Impossible de charger le classement : ${res.error.message}</p>`; return; }
    const rows = res.data || [];
    if (!rows.length) { list.innerHTML = '<p class="hub-note">Personne n\'est encore classé ce mois-ci. Joue une partie pour ouvrir le bal !</p>'; return; }
    const medal = p => p === 1 ? 'bd-gold' : p === 2 ? 'bd-silver' : p === 3 ? 'bd-bronze' : '';
    list.innerHTML = rows.map(r => {
      const val = boardTab === 'collectors' ? `${r.cards.toLocaleString('fr-FR')} cartes`
        : boardTab === 'all' ? `${Number(r.lp).toLocaleString('fr-FR')} PL`
        : `${League.badge(Math.min(25, Math.floor(r.lp / 100)), 'sm')}<span>${r.lp} PL</span>`;
      return `
        <div class="bd-row ${r.user_id === meId ? 'is-me' : ''}">
          <span class="bd-pos ${medal(Number(r.pos))}">${r.pos}</span>
          <span class="bd-avatar">${r.avatar_small && /^data:image\//.test(r.avatar_small) ? `<img src="${esc(r.avatar_small)}" alt="">` : `<b>${esc((r.pseudo || '?').slice(0, 1).toUpperCase())}</b>`}</span>
          <span class="bd-name"><strong>${esc(r.pseudo)}</strong><em>Niv. ${r.level}${r.wins !== undefined ? ` · ${r.wins} V · ${r.losses} D` : ''}</em></span>
          <span class="bd-val">${val}</span>
        </div>`;
    }).join('');
  }

  function renderRanks(c) {
    const best = {};
    GAMES.forEach(g => best[g.id] = League.getRank(g.id).index);
    c.innerHTML = `
      <div class="hub hub-ranks">
        <div class="mg-header">
          <button class="mg-back" data-home aria-label="Retour">‹</button>
          <div class="mg-header-title"><strong>Les 26 rangs</strong><span>100 PL par rang · on ne redescend jamais sous le début de son palier</span></div>
        </div>
        <div class="rk-ladder">
          ${League.RANKS.slice().reverse().map(r => `
            <div class="rk-row">
              ${League.badge(r.index, 'sm')}
              <span class="rk-name">${r.name}</span>
              <span class="rk-games">${GAMES.filter(g => best[g.id] === r.index).map(g => `<span class="rk-you">${g.name}</span>`).join('')}</span>
            </div>`).join('')}
        </div>
      </div>`;
    c.querySelector('[data-home]').addEventListener('click', () => { view = 'home'; render(); });
  }

  // Rafraîchit le hub quand un prestige tombe (si on le regarde)
  if (typeof Prestige !== 'undefined') {
    Prestige.onChange(() => {
      const c = container();
      if (c && c.querySelector('.hub') && document.getElementById('page-multi')?.classList.contains('active')) render();
    });
  }

  return { render, openGame, keepScreenOnce: false };
})();

if (typeof window !== 'undefined') window.GameHub = GameHub;
