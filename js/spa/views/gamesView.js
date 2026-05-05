// gamesView.js — Games section view stub
// Registers window.__SPA_Views['games'] and window.__SPA_GameNav.
// Replace with full Asymptote game engine integration.
(function() {
  window.__SPA_Views = window.__SPA_Views || {};

  window.__SPA_Views['games'] = {
    mount(itemId, containerEl) {
      containerEl.innerHTML = '';
      const el = document.createElement('div');
      el.className = 'asy-engine-hero';
      const motif = document.createElement('div');
      motif.className = 'asy-motif';
      motif.textContent = 'Asymptote Engine';
      el.appendChild(motif);
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'asy-hero-action';
      action.textContent = 'Play';
      action.addEventListener('click', () => {
        if (typeof window.__SPA_EnterCurrentGame === 'function') {
          window.__SPA_EnterCurrentGame();
        }
      });
      el.appendChild(action);
      containerEl.appendChild(el);
    },

    onActivate(_itemId) {},
    onDeactivate(_itemId) {},

    buildHeroProbe(itemId, containerEl) {
      const el = document.createElement('div');
      el.className = 'asy-engine-hero';
      el.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;width:320px;min-height:320px;';
      const motif = document.createElement('div');
      motif.className = 'asy-motif';
      motif.textContent = 'Asymptote Engine';
      el.appendChild(motif);
      document.body.appendChild(el);
      return { element: el, cleanup() { el.remove(); } };
    }
  };

  // Minimal GameNav stub — replace with real game navigation logic.
  let gameSectionIdx = 3;
  let gameItemIdx = 0;

  window.__SPA_GameNav = {
    getFromTarget() {
      return { sectionIdx: gameSectionIdx, itemIdx: gameItemIdx };
    },
    getToTarget(direction) {
      return { sectionIdx: gameSectionIdx, itemIdx: gameItemIdx };
    },
    commitTo(sectionIdx, itemIdx) {
      gameSectionIdx = sectionIdx;
      gameItemIdx = itemIdx;
    },
    buildHeroProbe(sectionIdx, itemIdx) {
      const el = document.createElement('div');
      el.className = 'asy-engine-hero';
      el.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;width:320px;min-height:320px;';
      const motif = document.createElement('div');
      motif.className = 'asy-motif';
      motif.textContent = 'Asymptote Engine';
      el.appendChild(motif);
      document.body.appendChild(el);
      return { element: el, cleanup() { el.remove(); } };
    },
    onTap() {}
  };
})();
