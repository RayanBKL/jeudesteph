// ============================================================
// THE ASHTRAY KING — Ultimate Comptoir (équipe de foot façon Ultimate Team)
// 11 footballeurs de ta collection en 4-3-3. Les joueurs voisins sont reliés :
//   vert   = même club (au moins un club en commun)
//   orange = même nationalité
//   rouge  = rien en commun
// Chaque joueur a une cohésion de 0 à 3 (liens + joue à son poste).
// La note du match = notes des joueurs × cohésion. Match simulé contre l'ordi.
// ============================================================

const UltimateTeam = (() => {
  const GAME = 'ut';
  const STORE = 'ut_squad_v1';

  // Formation 4-3-3 (x, y en % du terrain, y = 0 en haut côté attaque)
  const SLOTS = [
    { id: 'gb',  pos: 'GB',  x: 50, y: 89 },
    { id: 'dg',  pos: 'DEF', x: 13, y: 69 },
    { id: 'dc1', pos: 'DEF', x: 37, y: 73 },
    { id: 'dc2', pos: 'DEF', x: 63, y: 73 },
    { id: 'dd',  pos: 'DEF', x: 87, y: 69 },
    { id: 'mg',  pos: 'MIL', x: 24, y: 47 },
    { id: 'mc',  pos: 'MIL', x: 50, y: 52 },
    { id: 'md',  pos: 'MIL', x: 76, y: 47 },
    { id: 'ag',  pos: 'ATT', x: 17, y: 21 },
    { id: 'bu',  pos: 'ATT', x: 50, y: 14 },
    { id: 'ad',  pos: 'ATT', x: 83, y: 21 },
  ];
  const LINKS = [
    ['gb', 'dc1'], ['gb', 'dc2'], ['dg', 'dc1'], ['dc1', 'dc2'], ['dc2', 'dd'],
    ['dg', 'mg'], ['dc1', 'mg'], ['dc1', 'mc'], ['dc2', 'mc'], ['dc2', 'md'], ['dd', 'md'],
    ['mg', 'mc'], ['mc', 'md'], ['mg', 'ag'], ['mc', 'bu'], ['md', 'ad'], ['ag', 'bu'], ['bu', 'ad'],
  ];
  const POS_NAME = { GB: 'Gardien', DEF: 'Défenseur', MIL: 'Milieu', ATT: 'Attaquant' };

  // Remplaçants du quartier quand la collection ne suffit pas (aucun lien possible)
  const QUARTIER = ['Kévin du City-Stade', 'Momo Petit-Pont', 'Dédé Grand-Pied', 'Le Neveu du Patron', 'Jojo Tacle-Glissé',
    'Bébert Sans-Souffle', 'Sofiane Crochet', 'Le Facteur', 'Titi Pointu', 'Le Cousin de Gégé', 'Rachid Lucarne'];

  let st = null;

  // ── Données ────────────────────────────────────────────────
  function ownedFoot() {
    const inv = (typeof EmpireManager !== 'undefined') ? EmpireManager.getInventory() : {};
    return Object.keys(inv).filter(id => inv[id] > 0).map(id => getEmpireItemById(id)).filter(c => c && c.cat === 'foot');
  }

  function quartier(slotIdx) {
    return { id: 'q-' + slotIdx, name: QUARTIER[slotIdx], pos: SLOTS[slotIdx].pos, nat: '', clubs: [], ovr: 50, rarity: 'commune', quartier: true };
  }

  function loadSquad() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null') || Array(11).fill(null); } catch (e) { return Array(11).fill(null); }
  }
  function saveSquad(squad) {
    try { localStorage.setItem(STORE, JSON.stringify(squad)); } catch (e) {}
  }

  function playerAt(squad, i) {
    const id = squad[i];
    const c = id ? getEmpireItemById(id) : null;
    return c ? c : quartier(i);
  }

  // ── Liens et cohésion ──────────────────────────────────────
  function linkValue(a, b) {
    if (!a || !b || a.quartier || b.quartier) return 0;
    const shareClub = (a.clubs || []).some(c => (b.clubs || []).includes(c));
    const shareNat = a.nat && a.nat === b.nat;
    return (shareClub ? 2 : 0) + (shareNat ? 1 : 0);
  }
  function linkColor(v) { return v >= 2 ? 'green' : v === 1 ? 'orange' : 'red'; }

  function evaluate(players) {
    const idx = Object.fromEntries(SLOTS.map((s, i) => [s.id, i]));
    const sums = Array(11).fill(0), counts = Array(11).fill(0);
    const links = LINKS.map(([a, b]) => {
      const v = linkValue(players[idx[a]], players[idx[b]]);
      sums[idx[a]] += v; counts[idx[a]]++;
      sums[idx[b]] += v; counts[idx[b]]++;
      return { a, b, v, color: linkColor(v) };
    });
    const chem = players.map((p, i) => {
      if (p.quartier) return 0;
      // Moyenne des liens du joueur (0 = tout rouge, 3 = même club + même pays partout)
      const avg = sums[i] / counts[i];
      let c = avg >= 1.8 ? 3 : avg >= 1 ? 2 : avg >= 0.4 ? 1 : 0;
      if (p.pos !== SLOTS[i].pos) c = Math.max(0, c - 2);
      return c;
    });
    const cohesion = Math.round(chem.reduce((a, b) => a + b, 0) / 33 * 100);
    const eff = players.map((p, i) => {
      let r = (p.ovr || 50) * (0.85 + 0.05 * chem[i]);
      if (p.pos !== SLOTS[i].pos) r *= p.pos === 'GB' || SLOTS[i].pos === 'GB' ? 0.6 : 0.9;
      return r;
    });
    const line = pos => { const v = eff.filter((_, i) => SLOTS[i].pos === pos); return v.reduce((a, b) => a + b, 0) / v.length; };
    const ovr = Math.round(players.reduce((a, p) => a + (p.ovr || 50), 0) / 11);
    return { links, chem, cohesion, ovr, lines: { GB: line('GB'), DEF: line('DEF'), MIL: line('MIL'), ATT: line('ATT') }, power: Math.round(eff.reduce((a, b) => a + b, 0) / 11) };
  }

  // ── Composition automatique (la meilleure équipe possible, au poste) ──
  function autoSquad() {
    const pool = ownedFoot().slice().sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    const squad = Array(11).fill(null);
    const used = new Set();
    // 1) le meilleur joueur au poste pour chaque case
    SLOTS.forEach((s, i) => {
      const p = pool.find(c => !used.has(c.id) && c.pos === s.pos);
      if (p) { squad[i] = p.id; used.add(p.id); }
    });
    // 2) améliorations : échange qui fait monter la puissance (avec cohésion)
    for (let pass = 0; pass < 2; pass++) {
      SLOTS.forEach((s, i) => {
        let best = evaluate(squad.map((_, k) => playerAt(squad, k))).power;
        pool.filter(c => !used.has(c.id) && c.pos === s.pos).slice(0, 25).forEach(c => {
          const trial = squad.slice(); trial[i] = c.id;
          const pw = evaluate(trial.map((_, k) => playerAt(trial, k))).power;
          if (pw > best) { if (squad[i]) used.delete(squad[i]); squad[i] = c.id; used.add(c.id); best = pw; }
        });
      });
    }
    return squad;
  }

  // ── Équipe de l'ordi ───────────────────────────────────────
  const AI_NAMES = ['FC Comptoir', 'Olympique du PMU', 'AS Tabac-Presse', 'Racing Club du Balto', 'Sporting Kebab', 'Dynamo Pastis',
    'Real Mégot', 'Inter Cendrier', 'Atlético Belote', 'Bayern Ricard', 'Ajax du Rond-Point', 'Celtic Bar-Tabac'];

  function aiTeam(d) {
    const all = getAllBaseItemsList().filter(c => c.cat === 'foot' && c.pos);
    const target = 60 + d * 30;
    // On part d'un club ou d'une nation pour donner de la cohésion à l'ordi quand il monte
    const anchors = all.filter(c => (c.clubs || []).length);
    const anchor = anchors[Math.floor(Math.random() * anchors.length)];
    const club = anchor ? anchor.clubs[0] : null;
    const players = SLOTS.map(s => {
      let pool = all.filter(c => c.pos === s.pos && Math.abs((c.ovr || 60) - target) <= 6);
      if (club && Math.random() < 0.25 + d * 0.6) {
        const same = pool.filter(c => (c.clubs || []).includes(club));
        if (same.length) pool = same;
      }
      if (!pool.length) pool = all.filter(c => c.pos === s.pos);
      return pool[Math.floor(Math.random() * pool.length)];
    });
    return { name: AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)], players, ev: evaluate(players) };
  }

  // ── Écran de composition ───────────────────────────────────
  function start(container) {
    st = { container, squad: loadSquad(), view: 'squad' };
    if (st.squad.every(x => !x)) { st.squad = autoSquad(); saveSquad(st.squad); }
    render();
  }

  function shortName(n) {
    const parts = n.split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : n;
  }

  function chip(p, i, chem) {
    const img = p.quartier ? '' : CardsRenderer.resolveCardPhoto(p);
    const outPos = p.pos !== SLOTS[i].pos;
    return `
      <button class="ut-chip rv-r-${p.rarity} ${p.quartier ? 'is-quartier' : ''}" data-slot="${i}" style="left:${SLOTS[i].x}%;top:${SLOTS[i].y}%">
        <span class="ut-chip-photo">${img ? `<img src="${img}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="ut-chip-ovr">${p.ovr}</span></span>
        <span class="ut-chip-name">${shortName(p.name)}</span>
        <span class="ut-chip-meta"><span class="ut-pos ${outPos ? 'is-out' : ''}">${p.pos}</span><span class="ut-chem">${'●'.repeat(chem)}${'○'.repeat(3 - chem)}</span></span>
      </button>`;
  }

  function render() {
    const { container } = st;
    const players = st.squad.map((_, i) => playerAt(st.squad, i));
    const ev = evaluate(players);
    const owned = ownedFoot().length;
    const idx = Object.fromEntries(SLOTS.map((s, i) => [s.id, s]));
    container.innerHTML = `
      <div class="mg-screen mg-ut">
        ${GameUI.header(GAME, 'Ton équipe de 11, ta cohésion, ton match')}
        <div class="ut-stats">
          <div class="ut-stat"><span>Note</span><strong>${ev.ovr}</strong></div>
          <div class="ut-stat"><span>Cohésion</span><strong class="${ev.cohesion >= 70 ? 'is-good' : ev.cohesion >= 40 ? 'is-mid' : 'is-bad'}">${ev.cohesion}</strong></div>
          <div class="ut-stat"><span>Puissance</span><strong>${ev.power}</strong></div>
          <button class="btn-empire btn-empire-secondary ut-auto" data-auto>Auto</button>
        </div>
        <div class="ut-pitch">
          <svg class="ut-links" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${ev.links.map(l => `<line x1="${idx[l.a].x}" y1="${idx[l.a].y}" x2="${idx[l.b].x}" y2="${idx[l.b].y}" class="ut-link ut-link-${l.color}"/>`).join('')}
          </svg>
          ${players.map((p, i) => chip(p, i, ev.chem[i])).join('')}
        </div>
        <p class="mg-hint">${owned < 11 ? `Tu n'as que ${owned} footballeur${owned > 1 ? 's' : ''} : les trous sont bouchés par des joueurs du quartier. Ouvre des « Album du Ballon d'Or » !` : 'Touche un joueur pour le changer · vert = même club, orange = même pays'}</p>
        <div class="mg-actions">
          <button class="btn-empire btn-empire-primary" data-play>Jouer le match</button>
        </div>
      </div>`;
    GameUI.bindBack(container);
    container.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => openPicker(+b.dataset.slot)));
    container.querySelector('[data-auto]').addEventListener('click', () => {
      st.squad = autoSquad(); saveSquad(st.squad); render();
      if (typeof showToast === 'function') showToast('Meilleure équipe composée', 'success');
    });
    container.querySelector('[data-play]').addEventListener('click', playMatch);
  }

  // ── Choix d'un joueur pour une case ────────────────────────
  function openPicker(i) {
    const slot = SLOTS[i];
    const used = new Set(st.squad.filter(Boolean));
    const current = st.squad[i];
    const players = st.squad.map((_, k) => playerAt(st.squad, k));
    const base = evaluate(players);
    const candidates = ownedFoot().filter(c => !used.has(c.id) || c.id === current).map(c => {
      const trial = st.squad.slice(); trial[i] = c.id;
      const e = evaluate(trial.map((_, k) => playerAt(trial, k)));
      return { c, chem: e.chem[i], delta: e.power - base.power, cohesion: e.cohesion };
    }).sort((a, b) => (b.c.pos === slot.pos) - (a.c.pos === slot.pos) || b.delta - a.delta || (b.c.ovr || 0) - (a.c.ovr || 0)).slice(0, 80);

    const sheet = document.createElement('div');
    sheet.className = 'ut-picker';
    sheet.innerHTML = `
      <div class="ut-picker-card">
        <div class="ut-picker-head">
          <strong>${POS_NAME[slot.pos]}</strong>
          <button class="mg-back" data-close aria-label="Fermer">✕</button>
        </div>
        <div class="ut-picker-list">
          ${candidates.length ? candidates.map(({ c, chem, delta, cohesion }) => `
            <button class="ut-pick rv-r-${c.rarity} ${c.id === current ? 'is-current' : ''}" data-id="${c.id}">
              <span class="ut-pick-ovr">${c.ovr}</span>
              <span class="ut-pick-info"><strong>${c.name}</strong><span>${c.pos}${c.pos !== slot.pos ? ' (hors poste)' : ''} · ${c.nat || '—'}${(c.clubs || [])[0] ? ' · ' + c.clubs[0] : ''}</span></span>
              <span class="ut-pick-chem"><span class="ut-chem">${'●'.repeat(chem)}${'○'.repeat(3 - chem)}</span><em class="${delta >= 0 ? 'is-up' : 'is-down'}">${delta >= 0 ? '+' : ''}${delta}</em></span>
            </button>`).join('') : '<p class="hub-note">Aucun footballeur dans ta collection. Ouvre des paquets « Album du Ballon d\'Or » !</p>'}
        </div>
        ${current ? '<button class="btn-empire btn-empire-secondary" data-remove>Laisser un joueur du quartier</button>' : ''}
      </div>`;
    st.container.querySelector('.mg-screen').appendChild(sheet);
    const close = () => sheet.remove();
    sheet.querySelector('[data-close]').addEventListener('click', close);
    sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
    sheet.querySelector('[data-remove]')?.addEventListener('click', () => { st.squad[i] = null; saveSquad(st.squad); render(); });
    sheet.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => {
      st.squad[i] = b.dataset.id; saveSquad(st.squad); render();
    }));
  }

  // ── Match ──────────────────────────────────────────────────
  const COMMENTS = {
    goal: ['ET C\'EST LE BUT !', 'GOOOOAL ! Le Bar-Tabac exulte !', 'Lucarne ! Le gardien n\'a rien vu !', 'But ! Le patron offre la tournée !'],
    miss: ['juste à côté du poteau…', 'dans les nuages, à hauteur du balcon du 3e.', 'arrêté par le gardien, quelle parade !', 'sur la barre ! Le comptoir retient son souffle.'],
    calm: ['Ça se regarde en chiens de faïence au milieu.', 'Passes latérales, le public commande une autre pression.', 'Faute au milieu de terrain, l\'arbitre sort le sifflet.', 'Un supporter perd sa casquette, rien à signaler.'],
  };
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const sig = x => 1 / (1 + Math.exp(-x));

  async function playMatch() {
    const players = st.squad.map((_, i) => playerAt(st.squad, i));
    const me = { name: (typeof GameState !== 'undefined' && GameState.pseudo) || 'Mon équipe', players, ev: evaluate(players) };
    const ai = aiTeam(League.difficulty(GAME));
    const score = [0, 0];
    const feed = [];
    let skip = false;

    st.container.innerHTML = `
      <div class="mg-screen mg-ut mg-ut-match">
        ${GameUI.header(GAME, 'Match en direct')}
        <div class="ut-score">
          <div class="ut-team"><strong>${me.name}</strong><span>Note ${me.ev.ovr} · Coh. ${me.ev.cohesion}</span></div>
          <div class="ut-board"><span id="ut-s0">0</span><em id="ut-min">0'</em><span id="ut-s1">0</span></div>
          <div class="ut-team ut-team-ai"><strong>${ai.name}</strong><span>Note ${ai.ev.ovr} · Coh. ${ai.ev.cohesion}</span></div>
        </div>
        <div class="ut-feed" id="ut-feed"></div>
        <div class="mg-actions"><button class="btn-empire btn-empire-secondary" data-skip>Résultat direct</button></div>
      </div>`;
    GameUI.bindBack(st.container);
    st.container.querySelector('[data-skip]').addEventListener('click', () => { skip = true; });
    const feedEl = st.container.querySelector('#ut-feed');
    const push = (min, text, cls = '') => {
      feed.push(text);
      const row = document.createElement('div');
      row.className = `ut-event ${cls}`;
      row.innerHTML = `<em>${min}'</em><span>${text}</span>`;
      feedEl.prepend(row);
    };
    const scorer = team => {
      const pool = team.players.map((p, i) => ({ p, w: SLOTS[i].pos === 'ATT' ? 5 : SLOTS[i].pos === 'MIL' ? 2 : SLOTS[i].pos === 'DEF' ? 0.6 : 0.02 }));
      let x = Math.random() * pool.reduce((a, b) => a + b.w, 0);
      for (const e of pool) { x -= e.w; if (x <= 0) return e.p.name; }
      return pool[0].p.name;
    };

    push(0, `Coup d'envoi ! ${me.name} contre ${ai.name}.`);
    for (let min = 5; min <= 90; min += 5) {
      // Qui a le ballon ? Milieu contre milieu
      const ctrl = sig((me.ev.lines.MIL - ai.ev.lines.MIL) / 8);
      const side = Math.random() < ctrl ? 0 : 1;
      const att = side === 0 ? me : ai, def = side === 0 ? ai : me;
      const chance = 0.42 + (att.ev.lines.ATT - def.ev.lines.DEF) / 60;
      if (Math.random() < chance) {
        const shooter = scorer(att);
        const pGoal = 0.26 * sig((att.ev.lines.ATT - (def.ev.lines.DEF * 0.5 + def.ev.lines.GB * 0.5)) / 6) * 1.6;
        if (Math.random() < pGoal) {
          score[side]++;
          push(min, `<strong>${shooter}</strong> frappe… ${rnd(COMMENTS.goal)}`, side === 0 ? 'is-goal' : 'is-goal-ai');
          if (window.SoundFX) (side === 0 && SoundFX.win ? SoundFX.win() : SoundFX.click && SoundFX.click());
        } else {
          push(min, `${shooter} tente sa chance, ${rnd(COMMENTS.miss)}`);
        }
      } else if (Math.random() < 0.35) {
        push(min, rnd(COMMENTS.calm));
      }
      st.container.querySelector('#ut-s0').textContent = score[0];
      st.container.querySelector('#ut-s1').textContent = score[1];
      st.container.querySelector('#ut-min').textContent = min + "'";
      if (min === 45) push(45, `Mi-temps : ${score[0]} - ${score[1]}. Tout le monde file aux toilettes.`);
      if (!skip) await GameUI.sleep(650);
    }
    push(90, `Coup de sifflet final : ${score[0]} - ${score[1]}.`);
    const result = score[0] > score[1] ? 'win' : score[0] < score[1] ? 'loss' : 'draw';
    if (result === 'win' && score[1] === 0) Prestige.emit('perfect', { game: GAME });
    if (score[0] > 0 && typeof Prestige !== 'undefined') Prestige.emit('ut_goals', { n: score[0] });
    await GameUI.sleep(skip ? 100 : 700);
    GameUI.showResult(st.container.querySelector('.mg-screen'), GAME, result, `${score[0]} - ${score[1]} contre ${ai.name}`, () => start(st.container));
  }

  return { start, evaluate, SLOTS, LINKS };
})();

if (typeof window !== 'undefined') window.UltimateTeam = UltimateTeam;
