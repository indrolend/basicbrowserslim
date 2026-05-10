<<<<<<< HEAD
// gamesView.js - Games section view bridge.
// Renders economy-derived hero content for each Games item (understand/generate/upgrade/collapse).
// Economy state lives in window.AsymptoteApp. Navigation is handled by appKernel as normal SPA items.
(function () {
  window.__SPA_Views = window.__SPA_Views || {};

  var rafId = null;
  var currentItemId = null;

  function app() { return window.AsymptoteApp || null; }

  function fmt(n) {
    if (n == null || n !== n) return '-';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(1);
  }

  function emptySnap() {
    return { understanding: 0, ticks: 0, generatorCount: 0, generatorCost: 10,
             upgraded: false, upgradeCost: 100, clickPower: 1, productionMultiplier: 1, pps: 0 };
  }

  function heroText(itemId, snap) {
    if (itemId === 'understand') {
      return 'Understanding: ' + fmt(snap.understanding) +
             '\nPassive: ' + fmt(snap.pps) + '/s' +
             '\nClick Power: ' + fmt(snap.clickPower);
    }
    if (itemId === 'generate') {
      return 'Generators: ' + snap.generatorCount +
             '\nProduction: ' + fmt(snap.pps) + '/s' +
             '\nNext cost: ' + fmt(snap.generatorCost) + ' understanding';
    }
    if (itemId === 'upgrade') {
      if (snap.upgraded) {
        return 'Upgrade active\n2x Production multiplier';
      }
      return '2x Production Upgrade\nCost: ' + fmt(snap.upgradeCost) + ' understanding';
    }
    if (itemId === 'collapse') {
      return 'Sacrifice\nReset all — gain permanent click power\n' +
             (snap.understanding >= 50 || snap.generatorCount >= 5
               ? 'Ready' : 'Need 50 understanding or 5 generators');
    }
    return 'Asymptote';
  }

  function actionLabel(itemId, snap) {
    if (itemId === 'understand') return 'Pulse (+' + fmt(snap.clickPower) + ')';
    if (itemId === 'generate')   return 'Buy Generator';
    if (itemId === 'upgrade')    return snap.upgraded ? 'Purchased' : 'Buy Upgrade';
    if (itemId === 'collapse')   return 'Collapse';
    return 'Act';
  }

  function canAct(itemId, snap) {
    if (itemId === 'understand') return true;
    if (itemId === 'generate')   return snap.understanding >= snap.generatorCost;
    if (itemId === 'upgrade')    return !snap.upgraded && snap.understanding >= snap.upgradeCost;
    if (itemId === 'collapse')   return snap.understanding >= 50 || snap.generatorCount >= 5;
    return false;
  }

  function buildHeroEl(itemId, snap, isProbe, containerWidth) {
    var hero = document.createElement('div');
    hero.className = 'spa-hero spa-hero--text';
    if (isProbe) {
      hero.setAttribute('data-probe', '1');
      hero.style.cssText = 'position:absolute;left:-9999px;top:-9999px;pointer-events:none;width:' +
                           Math.max(220, containerWidth || 320) + 'px;';
    } else {
      hero.setAttribute('tabindex', '0');
    }

    var textEl = document.createElement('div');
    textEl.className = 'spa-hero-text';
    textEl.style.whiteSpace = 'pre-line';
    textEl.textContent = heroText(itemId, snap);
    hero.appendChild(textEl);

    if (!isProbe) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'asy-hero-action';
      btn.textContent = actionLabel(itemId, snap);
      btn.disabled = !canAct(itemId, snap);
      var a = app();
      btn.addEventListener('click', function () { if (a) a.doAction(itemId); });
      btn.addEventListener('touchend', function (e) { e.preventDefault(); if (a) a.doAction(itemId); });
      hero.appendChild(btn);
    }

    return hero;
  }

  function stopLiveRender() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function startLiveRender(itemId, containerEl) {
    stopLiveRender();
    currentItemId = itemId;
    function frame() {
      if (currentItemId !== itemId) return; // stale frame
      var textEl = containerEl.querySelector('.spa-hero-text');
      var btn    = containerEl.querySelector('.asy-hero-action');
      if (!textEl) { rafId = null; return; }
      var snap = app() ? app().getSnapshot() : emptySnap();
      textEl.textContent = heroText(itemId, snap);
      if (btn) {
        btn.textContent = actionLabel(itemId, snap);
        btn.disabled    = !canAct(itemId, snap);
      }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }

  window.__SPA_Views.games = {
    mount: function (itemId, containerEl) {
      stopLiveRender();
      if (!containerEl) return;
      containerEl.innerHTML = '';
      var snap = app() ? app().getSnapshot() : emptySnap();
      containerEl.appendChild(buildHeroEl(itemId, snap, false, containerEl.clientWidth));
      startLiveRender(itemId, containerEl);
    },

    onActivate: function (itemId) {
      var a = app();
      if (a) a.startTick();
    },

    onDeactivate: function (itemId) {
      stopLiveRender();
      currentItemId = null;
      // Tick continues — economy persists across navigation
    },

    buildHeroProbe: function (itemId, containerEl) {
      var root = containerEl || document.body;
      var snap = app() ? app().getSnapshot() : emptySnap();
      var probe = buildHeroEl(itemId, snap, true, containerEl && containerEl.clientWidth);
      root.appendChild(probe);
      return { element: probe, cleanup: function () { probe.remove(); } };
    }
  };
}());
=======
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
      action.dataset.action = 'enter-game';
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
>>>>>>> b57078b (Runtime reduction and continuity hardening)
