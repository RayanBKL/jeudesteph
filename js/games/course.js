// ============================================================
// THE ASHTRAY KING — Course Clandestine (classée)
// Réutilise le moteur de course PMU (js/race.js) : 4 couloirs, sprint à la clope.
// Le parcours et la vitesse des rivaux dépendent de ton rang.
// 1er = victoire, 2e = égalité, 3e/4e = défaite.
// ============================================================

const CourseClandestine = (() => {
  const GAME = 'course';
  let container = null;

  function trackFor(rankIndex) {
    if (rankIndex >= 15) return 'autoroute';
    if (rankIndex >= 6) return 'boulevard';
    return 'trottoir';
  }

  function start(c) {
    container = c;
    const r = League.getRank(GAME);
    const trackId = trackFor(r.index);
    const track = TRACKS[trackId];
    container.innerHTML = `
      <div class="mg-screen mg-course">
        ${GameUI.header(GAME, '4 coureurs, une seule place qui compte')}
        <div class="course-intro">
          <div class="course-track">
            <span class="course-track-kicker">Parcours du jour</span>
            <strong>${track.name}</strong>
            <span>${track.distance} m · rivaux réglés sur ton rang</span>
          </div>
          <ul class="course-rules">
            <li><strong>Appuie sur « Sprint »</strong> (ou la barre espace) pour tirer sur ta clope et accélérer.</li>
            <li>Trop de sprints d'un coup et Stéphane <strong>tousse</strong> : il s'arrête net.</li>
            <li><strong>1er</strong> : tu gagnes des points de ligue. <strong>2e</strong> : rien ne bouge. <strong>3e ou 4e</strong> : tu en perds.</li>
          </ul>
          <button class="btn-empire btn-empire-primary course-go" data-go>Prendre le départ</button>
        </div>
      </div>`;
    GameUI.bindBack(container);
    container.querySelector('[data-go]').addEventListener('click', () => {
      RaceEngine.leagueMode = { difficulty: League.difficulty(GAME) };
      RaceEngine.start(trackId);
    });
  }

  // Appelé par RaceEngine.finish() en mode classé
  function onFinish(playerRank, time) {
    RaceEngine.leagueMode = null;
    if (typeof GameHub !== 'undefined') GameHub.keepScreenOnce = true;
    if (typeof showPage === 'function') showPage('multi');
    if (typeof GameHub !== 'undefined') GameHub.openGame('course', true);
    const result = playerRank === 1 ? 'win' : playerRank === 2 ? 'draw' : 'loss';
    const screen = container && container.querySelector('.mg-screen');
    if (screen) {
      GameUI.showResult(screen, GAME, result, `${playerRank}${playerRank === 1 ? 're' : 'e'} place en ${time.toFixed(1).replace('.', ',')} s`, () => start(container));
    }
  }

  function onAbandon() {
    RaceEngine.leagueMode = null;
    if (typeof GameHub !== 'undefined') GameHub.keepScreenOnce = true;
    if (typeof showPage === 'function') showPage('multi');
    if (typeof GameHub !== 'undefined') GameHub.openGame('course', true);
    const screen = container && container.querySelector('.mg-screen');
    if (screen) GameUI.showResult(screen, GAME, 'loss', 'Abandon en pleine course', () => start(container));
  }

  return { start, onFinish, onAbandon };
})();

if (typeof window !== 'undefined') window.CourseClandestine = CourseClandestine;
