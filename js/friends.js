// ============================================================
// STÉPHANE — Friends & Challenges
// ============================================================

const Friends = {
  render() {
    this.renderCode();
    this.renderFriendsList();
    this.renderChallenges();
  },

  renderCode() {
    const el = document.getElementById('my-code');
    if (el) el.textContent = GameState.friendCode || '???';
  },

  renderFriendsList() {
    const el = document.getElementById('friends-list');
    if (!el) return;

    if (!GameState.friends.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>Aucun ami pour le moment. Partagez votre code !</p></div>';
      return;
    }

    el.innerHTML = GameState.friends.map(friend => `
      <div class="friend-item">
        <div class="friend-avatar">🚬</div>
        <div class="friend-info">
          <div class="friend-name">${friend.pseudo}</div>
          <div class="friend-status ${friend.online ? 'online' : ''}">
            ${friend.online ? '🟢 En ligne' : '⚫ Hors ligne'}
          </div>
          <div style="font-size:0.72rem;color:var(--text-dim)">${friend.code}</div>
        </div>
        <div class="friend-actions">
          <button class="btn-challenge" data-friend="${friend.code}">⚔️ Défier</button>
          <button class="btn-market-buy" data-friend="${friend.code}" style="font-size:0.75rem">🏪 Tabac</button>
          <button class="btn-market-remove" data-friend="${friend.code}" style="font-size:0.75rem">✕</button>
        </div>
      </div>
    `).join('');

    // Events
    el.querySelectorAll('.btn-challenge').forEach(btn => {
      btn.addEventListener('click', () => this.openChallengeModal(btn.dataset.friend));
    });
    el.querySelectorAll('.btn-market-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        GameState.friends = GameState.friends.filter(f => f.code !== btn.dataset.friend);
        saveGame();
        this.renderFriendsList();
        showToast('Ami supprimé', 'success');
      });
    });
    el.querySelectorAll('[data-friend].btn-market-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        showPage('marche');
        setTimeout(() => {
          Market.currentTab = 'amis';
          document.querySelectorAll('.market-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.mtab === 'amis');
          });
          Market.renderMarket();
        }, 200);
      });
    });
  },

  renderChallenges() {
    const el = document.getElementById('active-challenges');
    if (!el) return;

    const allChallenges = [
      ...GameState.sentChallenges.map(c => ({ ...c, type: 'sent' })),
      ...GameState.receivedChallenges.map(c => ({ ...c, type: 'received' })),
    ];

    if (!allChallenges.length) {
      el.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;padding:12px">Aucun défi en cours.</div>';
      return;
    }

    el.innerHTML = allChallenges.map(ch => {
      const friend = GameState.friends.find(f => f.code === ch.friendCode);
      const track = TRACKS[ch.track];
      const deadline = new Date(ch.deadline).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      const expired = Date.now() > ch.deadline;

      return `<div class="challenge-item">
        <div class="challenge-info">
          <strong>${ch.type === 'sent' ? '📤 Envoyé à' : '📥 Reçu de'} ${friend?.pseudo || ch.friendCode}</strong><br>
          Piste : ${track?.name || ch.track} · Mise : ${fmt(ch.mise)}<br>
          <span style="color:${expired ? 'var(--red)' : 'var(--text-dim)'}">
            ${expired ? 'Expiré !' : `Expire à ${deadline}`}
          </span>
          ${ch.myTime ? `<br>Votre temps : ${ch.myTime.toFixed(2)}s` : ''}
          ${ch.friendTime ? `<br>Temps ami : ${ch.friendTime.toFixed(2)}s` : ''}
        </div>
        <div>
          ${ch.type === 'sent' && !ch.myTime ? `<button class="btn-primary btn-sm btn-duel-race" data-challenge="${ch.id}">🏁 Courir</button>` : ''}
          ${ch.type === 'received' && ch.status === 'pending_friend' ? `
            <button class="btn-primary btn-sm btn-accept-challenge" data-challenge="${ch.id}">✅ Accepter</button>
            <button class="btn-secondary btn-sm btn-decline-challenge" data-challenge="${ch.id}">❌ Refuser</button>
          ` : ''}
          ${ch.status === 'resolved' ? `<span class="badge" style="background:${ch.winner === GameState.pseudo ? 'var(--green)' : 'var(--red)'}">${ch.winner === GameState.pseudo ? '🏆 Victoire' : '💀 Défaite'}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    // Events
    el.querySelectorAll('.btn-duel-race').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = GameState.sentChallenges.find(c => c.id === btn.dataset.challenge);
        if (!ch) return;
        // Start race for duel
        this.runDuelRace(ch);
      });
    });

    el.querySelectorAll('.btn-accept-challenge').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = GameState.receivedChallenges.findIndex(c => c.id === btn.dataset.challenge);
        if (idx >= 0) {
          GameState.receivedChallenges[idx].status = 'accepted';
          saveGame();
          this.renderChallenges();
          showToast('Défi accepté !', 'success');
        }
      });
    });

    el.querySelectorAll('.btn-decline-challenge').forEach(btn => {
      btn.addEventListener('click', () => {
        // Refund challenger
        const ch = GameState.receivedChallenges.find(c => c.id === btn.dataset.challenge);
        if (ch) {
          GameState.receivedChallenges = GameState.receivedChallenges.filter(c => c.id !== ch.id);
          saveGame();
          this.renderChallenges();
          showToast('Défi refusé', 'error');
        }
      });
    });
  },

  openChallengeModal(friendCode) {
    const friend = GameState.friends.find(f => f.code === friendCode);
    if (!friend) return;

    const trackOptions = Object.entries(TRACKS)
      .filter(([, t]) => GameState.level >= t.unlockLevel)
      .map(([id, t]) => `<option value="${id}">${t.icon} ${t.name}</option>`)
      .join('');

    openModal(`
      <h3 style="font-family:var(--font-title);font-size:1.6rem;color:var(--accent);margin-bottom:16px">⚔️ Défi contre ${friend.pseudo}</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-weight:700;display:block;margin-bottom:4px">Piste :</label>
          <select id="duel-track" class="game-select" style="width:100%">${trackOptions}</select>
        </div>
        <div>
          <label style="font-weight:700;display:block;margin-bottom:4px">Mise :</label>
          <input type="number" id="duel-mise" class="game-input" value="100" min="50" max="5000" placeholder="50 à 5000 €"/>
          <div style="font-size:0.75rem;color:var(--text-dim);margin-top:4px">Commission 5% prélevée sur les gains. Max 10 défis/jour avec le même ami.</div>
        </div>
        <button id="btn-confirm-challenge" class="btn-primary">⚔️ Lancer le défi !</button>
      </div>
    `);

    document.getElementById('btn-confirm-challenge')?.addEventListener('click', () => {
      const track = document.getElementById('duel-track')?.value;
      const mise = parseInt(document.getElementById('duel-mise')?.value || 100);
      if (!track) return showToast('Choisissez une piste', 'error');
      if (mise < 50 || mise > 5000) return showToast('Mise entre 50 et 5 000 €', 'error');
      const result = sendChallenge(friendCode, track, mise);
      if (!result.ok) { showToast(result.msg, 'error'); return; }
      closeModal();
      showToast(`⚔️ Défi envoyé à ${friend.pseudo} !`, 'success');
      this.renderChallenges();
    });
  },

  runDuelRace(challenge) {
    showPage('inventaire'); // Prompt user to go equip first
    // After player confirms, start race
    openModal(`
      <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--accent)">⚔️ Course Duel</h3>
      <p style="margin:12px 0;color:var(--text-muted)">Piste : ${TRACKS[challenge.track]?.name || challenge.track}<br>Mise : ${fmt(challenge.mise)}</p>
      <p style="font-size:0.85rem;color:var(--text-dim)">Votre temps sera comparé à celui de votre adversaire. La course est solo (asynchrone).</p>
      <div style="display:flex;gap:12px;margin-top:16px">
        <button id="btn-start-duel-race" class="btn-primary">🏁 Courir maintenant</button>
        <button id="btn-cancel-duel" class="btn-secondary">Annuler</button>
      </div>
    `);

    document.getElementById('btn-start-duel-race')?.addEventListener('click', () => {
      closeModal();
      GameState.selectedTrack = challenge.track;
      RaceEngine.start(challenge.track);
      // After race, save time and resolve
      const originalFinish = RaceEngine.finish.bind(RaceEngine);
      RaceEngine.finish = function() {
        originalFinish();
        // Store time in challenge
        const ch = GameState.sentChallenges.find(c => c.id === challenge.id);
        if (ch) {
          ch.myTime = RaceEngine.elapsed;
          // Simulate friend time
          const track = TRACKS[challenge.track];
          const friendTime = track.goldTime * (0.8 + Math.random() * 0.5);
          ch.friendTime = friendTime;
          // Resolve
          const won = ch.myTime < ch.friendTime;
          ch.status = 'resolved';
          ch.winner = won ? GameState.pseudo : 'Ami';
          const cagnotte = ch.mise * 2;
          if (won) {
            const gain = Math.round(cagnotte * (1 - GAME_CONST.DUEL_COMMISSION));
            earnMoney(gain);
            showToast(`🏆 Duel gagné ! +${fmt(gain)} !`, 'gold');
            GameState.totalWins++;
          } else {
            showToast(`💀 Duel perdu. Ton temps : ${ch.myTime.toFixed(2)}s · Ami : ${ch.friendTime.toFixed(2)}s`, 'error');
          }
          saveGame();
        }
        RaceEngine.finish = originalFinish;
      };
    });

    document.getElementById('btn-cancel-duel')?.addEventListener('click', closeModal);
  },
};

// ============================================================
// LEADERBOARD
// ============================================================
const Leaderboard = {
  currentTab: 'fortune',
  currentScope: 'global',

  render() {
    const el = document.getElementById('lb-list');
    if (!el) return;

    let entries = this.getEntries();
    el.innerHTML = entries.map((e, i) => {
      const rank = i + 1;
      let rankClass = rank <= 3 ? `r${rank}` : '';
      let display = '';
      switch (this.currentTab) {
        case 'fortune':  display = fmt(e.fortune); break;
        case 'temps':    display = e.bestTime?.trottoir ? e.bestTime.trottoir + 's' : '--'; break;
        case 'victoires':display = (e.wins || 0) + ' victoires'; break;
        case 'vitrine':  display = RARITIES[e.rarity]?.name || 'Commune'; break;
      }
      const isMe = e.pseudo === GameState.pseudo;
      return `<div class="lb-row" style="${isMe ? 'border-color:var(--accent);background:rgba(255,140,0,0.08)' : ''}">
        <div class="lb-rank ${rankClass}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</div>
        <div class="lb-name">${e.pseudo} ${isMe ? '👈 (Vous)' : ''}</div>
        <div class="lb-val">${display}</div>
      </div>`;
    }).join('');
  },

  getEntries() {
    let raw = [...(GameState.globalLB || [])];
    // Add self
    const self = {
      pseudo: GameState.pseudo,
      fortune: GameState.money,
      bestTime: GameState.bestTimes,
      wins: GameState.totalWins,
      rarity: this.getHighestRarity(),
    };

    if (this.currentScope === 'amis') {
      raw = GameState.friends.map(f => ({
        pseudo: f.pseudo,
        fortune: Math.floor(Math.random() * 50000),
        bestTime: { trottoir: (38 + Math.random() * 20).toFixed(1) },
        wins: Math.floor(Math.random() * 30),
        rarity: 'commune',
      }));
    }

    raw.push(self);

    switch (this.currentTab) {
      case 'fortune':  return raw.sort((a,b) => (b.fortune||0) - (a.fortune||0)).slice(0,20);
      case 'temps':    return raw.filter(e => e.bestTime?.trottoir).sort((a,b) => parseFloat(a.bestTime.trottoir) - parseFloat(b.bestTime.trottoir)).slice(0,20);
      case 'victoires':return raw.sort((a,b) => (b.wins||0) - (a.wins||0)).slice(0,20);
      case 'vitrine':  return raw.sort((a,b) => {
        const ro = ['commune','peu-commune','rare','epique','legendaire','mythique'];
        return ro.indexOf(b.rarity) - ro.indexOf(a.rarity);
      }).slice(0,20);
      default: return raw.slice(0,20);
    }
  },

  getHighestRarity() {
    const ro = ['mythique','legendaire','epique','rare','peu-commune','commune'];
    for (const r of ro) {
      if (Object.values(GameState.inventory).some(e => e.cig.rarity === r)) return r;
    }
    return 'commune';
  },
};
