// gamesView.js — Games section view stub
// Registers window.__SPA_Views['games'] and window.__SPA_GameNav.
// Replace with full Asymptote game engine integration.
(function() {
  window.__SPA_Views = window.__SPA_Views || {};

  function createGameHeroElement({ hidden = false, includeAction = false } = {}) {
    const el = document.createElement('div');
    el.className = 'asy-engine-hero';
    if (hidden) {
      el.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;width:320px;min-height:320px;';
    }

    const motif = document.createElement('div');
    motif.className = 'asy-motif';
    motif.textContent = 'Asymptote Engine';
    el.appendChild(motif);

    if (includeAction) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'asy-hero-action';
      action.textContent = 'Play';
      action.dataset.action = 'enter-game';
      el.appendChild(action);
    }

    return el;
  }

  function buildGameHeroProbe() {
    const element = createGameHeroElement({ hidden: true });
    document.body.appendChild(element);
    return {
      element,
      cleanup() { element.remove(); }
    };
  }

  window.__SPA_Views['games'] = {
    mount(itemId, containerEl) {
      containerEl.innerHTML = '';
      containerEl.appendChild(createGameHeroElement({ includeAction: true }));
    },

    onActivate(_itemId) {},
    onDeactivate(_itemId) {},

    buildHeroProbe(itemId, containerEl) {
      return buildGameHeroProbe();
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
      return buildGameHeroProbe();
    },
    onTap() {}
  };
})();
