// ============================================================
// THE ASHTRAY KING — Éléments communs aux mini-jeux
// En-tête de partie, écran de fin (points de ligue, montée de rang).
// ============================================================

const GameUI = (() => {
  const RULES = {
    ut: [
      'Place 11 de tes footballeurs en 4-3-3 (ou appuie sur « Auto »).',
      'Deux joueurs voisins sont reliés : <b class="r-green">vert</b> s\'ils ont joué dans le même club, <b class="r-orange">orange</b> s\'ils ont la même nationalité, <b class="r-red">rouge</b> sinon.',
      'Chaque joueur a 0 à 3 points de cohésion selon ses liens. Hors de son poste, il en perd 2.',
      'La puissance de l\'équipe = les notes des joueurs × leur cohésion. Le milieu décide qui a le ballon, l\'attaque contre la défense décide des buts.',
      'Pas assez de footballeurs ? Les trous sont bouchés par des joueurs du quartier (note 50, aucun lien). Ouvre des « Album du Ballon d\'Or ».',
    ],
    bataille: [
      'Tu reçois 5 cartes de ta collection, l\'ordi aussi.',
      'Chaque manche se joue sur une stat tirée au sort : Passif, Clic ou Cote.',
      'Chacun pose une carte : la plus forte sur cette stat gagne la manche.',
      'Premier à 3 manches. Astuce : garde tes meilleures cartes pour les manches où elles comptent.',
    ],
    des421: [
      'Tu as 3 lancers de 3 dés. Après un lancer, touche les dés que tu veux garder (ils montent et deviennent dorés), puis relance les autres.',
      '« Je garde » arrête ton tour. Ensuite l\'ordi joue avec autant de lancers que toi.',
      'Les combinaisons, de la meilleure à la moins bonne : <b>4-2-1</b> · <b>Mac</b> (trois 1) · <b>Brelan</b> (trois dés pareils) · <b>Deux as + un dé</b> · <b>Suite</b> (ex. 3-4-5) · puis les points (le plus grand nombre formé gagne : 6-5-3 bat 6-4-4).',
      'La <b>Nénette</b> (2-2-1) est la pire main du jeu.',
      'La meilleure combinaison gagne la manche. Premier à 2 manches.',
    ],
    pbc: [
      'La <b>pierre</b> casse le briquet, le <b>briquet</b> allume la clope, la <b>clope</b> enfume la pierre.',
      'Choisis ton coup, l\'ordi choisit le sien en même temps. Premier à 3 points.',
      'Plus tu montes en ligue, plus l\'ordi repère tes habitudes : varie tes coups.',
    ],
    quiz: [
      '10 questions : une photo de carte, 4 noms proposés.',
      '8 secondes par question. Bonne réponse = 100 points + jusqu\'à 50 points de rapidité.',
      'L\'ordi répond en même temps. Plus tu montes, plus il est rapide et juste.',
    ],
    course: [
      'Appuie sur « Sprint » (ou la barre espace) pour tirer sur ta clope : ton énergie remonte et tu accélères.',
      'Chaque sprint fait monter la toux. À 100, Stéphane tousse et s\'arrête net pendant 3 secondes.',
      'Astuce : sprinte quand ton énergie est entre 10 et 25, c\'est le timing parfait (+50 % et presque pas de toux).',
      '1er : tu gagnes des points de ligue. 2e : rien ne bouge. 3e ou 4e : tu en perds.',
    ],
  };

  function showRules(game) {
    const host = document.querySelector('#multi-content .mg-screen') || document.getElementById('multi-content');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'mg-rules';
    el.innerHTML = `
      <div class="mg-rules-card">
        <div class="mg-rules-head"><strong>Comment jouer · ${League.GAMES[game].name}</strong><button class="mg-back" data-close aria-label="Fermer">✕</button></div>
        <ol>${(RULES[game] || []).map(r => `<li>${r}</li>`).join('')}</ol>
        <button class="btn-empire btn-empire-primary" data-close>Compris</button>
      </div>`;
    host.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) el.remove(); });
  }

  function header(game, subtitle = '') {
    const r = League.getRank(game);
    return `
      <div class="mg-header">
        <button class="mg-back" data-mg-back aria-label="Retour à la salle de jeux">‹</button>
        <div class="mg-header-title">
          <strong>${League.GAMES[game].name}</strong>
          <span>${subtitle || 'Partie classée contre l\'ordinateur'}</span>
        </div>
        <div class="mg-header-rank">${League.badge(r.index, 'sm')}<span>${r.name}</span></div>
        <button class="mg-help" data-mg-help="${game}" aria-label="Règles du jeu">?</button>
      </div>`;
  }

  // Affiche le résultat d'une partie classée par-dessus le jeu (les points viennent du serveur)
  async function showResult(container, game, result, detail, onReplay, pre) {
    const title = result === 'win' ? 'Victoire !' : result === 'loss' ? 'Défaite' : 'Égalité';
    const el = document.createElement('div');
    el.className = `mg-result mg-result-${result}`;
    el.innerHTML = `<div class="mg-result-card"><div class="mg-result-title">${title}</div><p class="mg-result-detail">${detail || ''}</p><p class="mg-wait">Enregistrement de la partie…</p></div>`;
    container.appendChild(el);

    const res = pre !== undefined ? pre : await League.record(game, result);
    const xp = result === 'win' ? 30 : result === 'draw' ? 15 : 8;
    const actions = `
      <div class="mg-result-actions">
        <button class="btn-empire btn-empire-secondary" data-mg-back>Salle de jeux</button>
        <button class="btn-empire btn-empire-primary" data-mg-replay>Rejouer</button>
      </div>`;

    if (res.error) {
      el.querySelector('.mg-result-card').innerHTML = `
        <div class="mg-result-title">${title}</div>
        <p class="mg-result-detail">${detail || ''}</p>
        <p class="mg-unranked">Partie non classée : ${res.error}</p>${actions}`;
    } else {
      if (typeof ClickerEngine !== 'undefined' && ClickerEngine.gainXP) ClickerEngine.gainXP(xp);
      const sign = res.delta > 0 ? '+' : '';
      const top = res.after.index === League.RANKS.length - 1;
      el.querySelector('.mg-result-card').innerHTML = `
        <div class="mg-result-title">${title}</div>
        <p class="mg-result-detail">${detail || ''} · +${xp} XP</p>
        <div class="mg-result-rank">
          ${League.badge(res.after.index, 'lg')}
          <div class="mg-result-rank-info">
            <strong>${res.after.name}</strong>
            <span class="mg-lp-delta ${res.delta >= 0 ? 'is-up' : 'is-down'}">${sign}${res.delta} PL</span>
            <div class="mg-lp-bar"><div class="mg-lp-fill" style="width:${top ? 100 : res.after.inRank}%"></div></div>
            <span class="mg-lp-text">${top ? `${res.after.inRank} PL au sommet` : `${res.after.inRank} / 100 PL`}</span>
          </div>
        </div>
        ${res.promoted ? `<div class="mg-promo">Promotion : ${res.after.name} !</div>` : ''}
        ${res.demoted ? `<div class="mg-demo">Rétrogradé en ${res.after.name}</div>` : ''}
        ${res.streak >= 3 ? `<div class="mg-streak">${res.streak} victoires d'affilée</div>` : ''}
        ${res.capped ? `<p class="mg-unranked">Plafond contre l'ordinateur atteint (Buraliste I). Pour monter plus haut, il faut battre de vrais joueurs.</p>` : ''}
        ${actions}`;
    }
    if (window.SoundFX) {
      if (result === 'win' && SoundFX.win) SoundFX.win();
      else if (result === 'loss' && SoundFX.cough) SoundFX.cough();
    }
    el.querySelector('[data-mg-replay]').addEventListener('click', () => onReplay && onReplay());
    bindBack(el);
    return res;
  }

  function bindBack(root) {
    root.querySelectorAll('[data-mg-back]').forEach(b => b.addEventListener('click', () => GameHub.render()));
    root.querySelectorAll('[data-mg-help]').forEach(b => b.addEventListener('click', () => showRules(b.dataset.mgHelp)));
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { header, showResult, bindBack, sleep, showRules, RULES };
})();

if (typeof window !== 'undefined') window.GameUI = GameUI;
