// ============================================================
// THE ASHTRAY KING — Fenêtres de dialogue du jeu (remplacent confirm / prompt / alert du navigateur)
// ============================================================

const GameDialog = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function open({ title, text, input, ok = 'OK', cancel = 'Annuler', danger = false, single = false }) {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'soc-modal dlg-modal';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.innerHTML = `
        <div class="soc-modal-card dlg-card">
          ${title ? `<h3>${esc(title)}</h3>` : ''}
          ${text ? `<p class="dlg-text">${esc(text)}</p>` : ''}
          ${input ? `<input class="game-input dlg-input" type="${esc(input.type || 'text')}" placeholder="${esc(input.placeholder || '')}" maxlength="${+input.maxlength || 120}" autocomplete="off" />` : ''}
          <div class="dlg-actions">
            ${single ? '' : `<button class="btn-empire btn-empire-secondary" data-no>${esc(cancel)}</button>`}
            <button class="btn-empire ${danger ? 'btn-empire-danger' : 'btn-empire-primary'}" data-yes>${esc(ok)}</button>
          </div>
        </div>`;
      document.body.appendChild(el);
      const field = el.querySelector('.dlg-input');
      const done = v => { el.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const yes = () => done(input ? field.value : true);
      const no = () => done(input ? null : false);
      const onKey = e => {
        if (e.key === 'Escape') { e.stopPropagation(); single ? yes() : no(); }
        else if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); yes(); }
      };
      document.addEventListener('keydown', onKey, true);
      el.querySelector('[data-yes]').addEventListener('click', yes);
      el.querySelector('[data-no]')?.addEventListener('click', no);
      el.addEventListener('click', e => { if (e.target === el && !single) no(); });
      (field || el.querySelector('[data-yes]')).focus();
    });
  }

  return {
    confirm: (text, o = {}) => open({ text, ...o }),
    prompt: (text, o = {}) => open({ text, input: o.input || {}, ...o }),
    alert: (text, o = {}) => open({ text, single: true, ...o }),
  };
})();

if (typeof window !== 'undefined') window.GameDialog = GameDialog;
