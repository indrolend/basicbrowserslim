// appKernel.js — application state machine and transition lifecycle
//
// Extracts all state and lifecycle from main.js into an explicit kernel.
//
// Owns:
//   - AppState (current position, transition phase, pull state, game mode, queued nav)
//   - Navigation: goTo, navigate
//   - Overlay lifecycle: open/close with transition
//   - Game mode lifecycle: enter/exit/navigate
//   - Slingshot gesture callbacks: onTap, onLock, onPull, onRelease, onCancel
//   - Hero action dispatch
//
// Does NOT own: DOM structure, canvas, or particle sampling. It owns when
// render commits happen, while renderers own the concrete DOM they write.

import { getSection, getItem, getClickAction, SLINGSHOT_MIN_RELEASE } from './spaData.js';
import { getSafeExternalUrl } from './utils.js';
import { getTargetForDirection } from './navModel.js';
import { ensureOverlayRuntime, ensureSectionRuntime } from './runtimeModules.js';

export function createAppKernel({
  surfaceManager,
  transitionKernel,
  heroRenderer,
  navRenderer,
  rasterizeHero,
  heroContainer
}) {
  // ─── AppState ─────────────────────────────────────────────────────────────

  // Canonical live state: every event mutates this object, every render commit
  // reads from it. Transition-only scratch data remains below.
  const state = {
    si: 0,
    ii: 0,
    // 'idle' | 'transitioning' | 'pulling'
    phase: 'idle',
    homeSectionLocked: false,
    isGameActive: false,
    queuedTarget: null
  };

  // Slingshot pull state
  let _pullTargetSi        = null, _pullTargetIi   = null;
  let _pullFromSurface     = null, _pullToSurface  = null;
  let _pullFromPromise     = null, _pullToPromise  = null;
  let _pullParticles       = null;
  let _pullCanvasW         = 0,   _pullCanvasH    = 0;

  // ─── State helpers ────────────────────────────────────────────────────────

  function _isTransitioning() { return state.phase !== 'idle'; }
  function _isPulling()       { return state.phase === 'pulling'; }

  // Visible UI state contract: 'idle' | 'transitioning' | 'pulling' | 'overlay'
  function _computeUiState() {
    if (state.phase !== 'idle') return state.phase;
    return window.__SPA_Overlay?.isOpen?.() ? 'overlay' : 'idle';
  }

  function _syncUiState() {
    const section = getSection(state.si);
    document.body.dataset.state = _computeUiState();
    document.body.dataset.section = section?.id ?? '';
    document.body.dataset.item = String(state.ii);
  }

  function _setPhase(nextPhase) {
    state.phase = nextPhase;
    _syncUiState();
  }

  function _activate(si, ii) {
    const section = getSection(si), item = getItem(si, ii);
    if (section && item) try { window.__SPA_Views?.[section.id]?.onActivate?.(item.id); } catch (_) {}
  }

  function _deactivate(si, ii) {
    const section = getSection(si), item = getItem(si, ii);
    if (section && item) try { window.__SPA_Views?.[section.id]?.onDeactivate?.(item.id); } catch (_) {}
  }

  function _commitPosition(si, ii) {
    state.si = si;
    state.ii = ii;
  }

  function _commitView(si = state.si, ii = state.ii, { hero = true, nav = true } = {}) {
    if (hero) heroRenderer.renderHeroDOM(si, ii);
    if (nav) {
      navRenderer.updateSectionNav(si, state.homeSectionLocked);
      navRenderer.updateItemDots(si, ii);
    }
    _syncUiState();
  }

  function _render() {
    _commitView();
  }

  async function _ensureRuntimeFor(si) {
    const section = getSection(si);
    if (section) await ensureSectionRuntime(section.id);
  }

  function _inferAutoPullVector(nextSi, nextIi) {
    if (nextSi === state.si && nextIi === state.ii) return { x: 1, y: 0 };
    if (nextSi === state.si) return { x: nextIi > state.ii ? 1 : -1, y: 0 };
    return { x: nextSi > state.si ? 1 : -1, y: 0 };
  }

  async function _withTransition(run, { drainQueue = false } = {}) {
    _setPhase('transitioning');
    try {
      await run();
    } finally {
      _setPhase('idle');
      if (drainQueue) _drainQueue();
    }
  }

  // ─── goTo ─────────────────────────────────────────────────────────────────

  async function goTo(nextSi, nextIi) {
    if (state.homeSectionLocked && nextSi === 0 && state.si !== 0) return;
    if (nextSi === state.si && nextIi === state.ii && !_isPulling()) return;
    if (_isTransitioning() || _isPulling()) {
      state.queuedTarget = { sectionIdx: nextSi, itemIdx: nextIi };
      return;
    }

    await _withTransition(async () => {
      await Promise.all([_ensureRuntimeFor(state.si), _ensureRuntimeFor(nextSi)]);
      const fromSi = state.si, fromIi = state.ii;
      _deactivate(fromSi, fromIi);

      let fromSurf, toSurf;
      try { [fromSurf, toSurf] = await Promise.all([surfaceManager.buildSurface(fromSi, fromIi, 'from'), surfaceManager.buildSurface(nextSi, nextIi, 'to')]); } catch (_) {}

      let didRenderDuringReveal = false;
      try {
        await transitionKernel.runSlingshotRelease({
          pulledParticles: null,
          pulledCanvasW: 0,
          pulledCanvasH: 0,
          fromSurface: fromSurf,
          toSurface: toSurf,
          autoPullVector: _inferAutoPullVector(nextSi, nextIi),
          onBeforeReveal: async () => {
            _closeOverlayForNav();
            if (nextSi !== 0 && !state.homeSectionLocked) state.homeSectionLocked = true;
            _commitPosition(nextSi, nextIi);
            _commitView();
            didRenderDuringReveal = true;
          }
        });
      } finally {
        _commitPosition(nextSi, nextIi);
        _activate(nextSi, nextIi);

        if (!didRenderDuringReveal) _render();
      }
    }, { drainQueue: true });
  }

  // ─── Overlay lifecycle ────────────────────────────────────────────────────

  function _closeOverlayForNav() {
    window.__SPA_Overlay?.isOpen() && window.__SPA_Overlay.close({ restore: false });
  }

  async function openOverlayWithTransition(overlayId) {
    if (_isTransitioning() || _isPulling()) return;
    await ensureOverlayRuntime().catch(() => {});
    const overlay = window.__SPA_Overlay;
    if (!overlay) return;

    const probe = overlay.buildProbe?.(overlayId, {}, { inline: true });
    if (!probe) { overlay.open(overlayId); _syncUiState(); return; }

    await _withTransition(async () => {
      let fromSurf, toSurf;
      try {
        document.body.appendChild(probe.element);
        [fromSurf, toSurf] = await Promise.all([
          surfaceManager.buildSurface(state.si, state.ii, 'from'),
          rasterizeHero({ type: 'textElement', element: probe.element })
        ]);
      } catch (_) {
        probe.cleanup?.();
        overlay.open(overlayId);
        _syncUiState();
        return;
      }

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => { probe.cleanup?.(); overlay.openInline(overlayId, {}, heroContainer); }
      });
    });
  }

  async function closeOverlayWithTransition() {
    const overlay = window.__SPA_Overlay;
    if (!overlay?.isOpen() || _isTransitioning() || _isPulling()) return;

    await _withTransition(async () => {
      let fromSurf, toSurf;
      try { [fromSurf, toSurf] = await Promise.all([surfaceManager.buildSurface(state.si, state.ii, 'from'), surfaceManager.buildSurface(state.si, state.ii, 'to')]); } catch (_) {}

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => { overlay.close({ restore: false }); _commitView(state.si, state.ii, { nav: false }); }
      });
    });
  }

  // ─── Game mode lifecycle ──────────────────────────────────────────────────

  async function enterCurrentGameWithTransition() {
    if (_isTransitioning() || _isPulling()) return;
    await _ensureRuntimeFor(state.si);
    const gameNav = window.__SPA_GameNav;
    if (!gameNav) return;
    const probe = gameNav.buildHeroProbe?.(state.si, state.ii);
    if (!probe) return;

    await _withTransition(async () => {
      document.body.appendChild(probe.element);

      let fromSurf, toSurf;
      try { [fromSurf, toSurf] = await Promise.all([surfaceManager.buildSurface(state.si, state.ii, 'from'), rasterizeHero({ type: 'textElement', element: probe.element })]); }
      catch (_) { probe.cleanup?.(); return; }
      probe.cleanup?.();

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => {
          state.isGameActive = true;
          window.__SPA_Views?.['games']?.mount?.('asymptote', heroContainer);
        }
      });
    });
  }

  async function exitGameToCurrentItem() {
    if (_isTransitioning() || _isPulling()) return;

    await _withTransition(async () => {
      let fromSurf, toSurf;
      try { [fromSurf, toSurf] = await Promise.all([surfaceManager.buildSurface(state.si, state.ii, 'from'), surfaceManager.buildSurface(state.si, state.ii, 'to')]); } catch (_) {}

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => { state.isGameActive = false; _commitView(state.si, state.ii, { nav: false }); }
      });
    });
  }

  async function gameNavigate(direction) {
    await _ensureRuntimeFor(state.si);
    const gameNav = window.__SPA_GameNav;
    if (!gameNav || _isTransitioning() || _isPulling()) return;
    const from = gameNav.getFromTarget?.();
    const to   = gameNav.getToTarget?.(direction);
    if (!from || !to) return;

    const fromProbe = gameNav.buildHeroProbe?.(from.sectionIdx, from.itemIdx);
    const toProbe   = gameNav.buildHeroProbe?.(to.sectionIdx,   to.itemIdx);
    if (!fromProbe || !toProbe) { fromProbe?.cleanup?.(); toProbe?.cleanup?.(); return; }

    await _withTransition(async () => {
      document.body.appendChild(fromProbe.element);
      document.body.appendChild(toProbe.element);

      let fromSurf, toSurf;
      try {
        [fromSurf, toSurf] = await Promise.all([
          rasterizeHero({ type: 'textElement', element: fromProbe.element }),
          rasterizeHero({ type: 'textElement', element: toProbe.element })
        ]);
      } catch (_) { fromProbe.cleanup?.(); toProbe.cleanup?.(); return; }
      fromProbe.cleanup?.(); toProbe.cleanup?.();

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => {
          _commitPosition(to.sectionIdx, to.itemIdx);
          _commitView(state.si, state.ii, { hero: false });
          gameNav.commitTo?.(to.sectionIdx, to.itemIdx);
          window.__SPA_Views?.['games']?.mount?.('asymptote', heroContainer);
        }
      });
    });
  }

  // ─── Slingshot callbacks ──────────────────────────────────────────────────

  function onTap() {
    if (window.__SPA_Overlay?.shouldSuppressTap?.()) return;
    if (window.__SPA_Overlay?.isOpen()) { void closeOverlayWithTransition(); return; }
    if (state.isGameActive) { window.__SPA_GameNav?.onTap?.(); return; }
    const action = getClickAction(state.si, state.ii);
    if (action) _handleHeroAction(action);
  }

  function onLock({ direction }) {
    if (state.phase === 'transitioning') {
      const t = getTargetForDirection(direction, state.si, state.ii, state.homeSectionLocked);
      if (t) state.queuedTarget = { sectionIdx: t.sectionIdx, itemIdx: t.itemIdx };
      return false;
    }
    if (_isPulling()) return false;

    let targetSi, targetIi;
    if (state.isGameActive && window.__SPA_GameNav) {
      const t = window.__SPA_GameNav.getToTarget?.(direction);
      if (!t) return false;
      targetSi = t.sectionIdx; targetIi = t.itemIdx;
    } else {
      const t = getTargetForDirection(direction, state.si, state.ii, state.homeSectionLocked);
      if (!t) return false;
      targetSi = t.sectionIdx; targetIi = t.itemIdx;
    }

    _pullTargetSi = targetSi;
    _pullTargetIi = targetIi;
    _setPhase('pulling');
    transitionKernel.resetPullPreview();
    _pullParticles = null;

    // Build surfaces in parallel while the user is pulling
    const fp = _ensureRuntimeFor(state.si).then(() => surfaceManager.buildSurface(state.si, state.ii, 'from'));
    const tp = _ensureRuntimeFor(targetSi).then(() => surfaceManager.buildSurface(targetSi, targetIi, 'to'));
    _pullFromPromise = fp;
    _pullToPromise   = tp;
    fp.then(s => { if (_pullFromPromise === fp) _pullFromSurface = s; }).catch(() => {});
    tp.then(s => { if (_pullToPromise   === tp) _pullToSurface   = s; }).catch(() => {});

    transitionKernel.alignCanvas({ width: 320, height: 320 }, { width: 320, height: 320 });
    transitionKernel.showCanvas();
    transitionKernel.hideHero();

    return true;
  }

  function onPull({ pullVector, pullNormalized }) {
    if (_pullFromSurface) transitionKernel.alignCanvas(_pullFromSurface, _pullFromSurface);
    const result = transitionKernel.renderPullPreview(pullVector, pullNormalized, _pullFromSurface);
    if (result) {
      _pullParticles = result.particles;
      _pullCanvasW   = result.canvasW;
      _pullCanvasH   = result.canvasH;
    } else {
      _pullParticles = null;
    }
  }

  async function onRelease({ pullNormalized }) {
    if (pullNormalized < SLINGSHOT_MIN_RELEASE) { cancelSlingshot(); return; }

    const targetSi = _pullTargetSi, targetIi = _pullTargetIi;

    let fromSurf, toSurf;
    try {
      [fromSurf, toSurf] = await Promise.all([
        _pullFromPromise || surfaceManager.buildSurface(state.si, state.ii, 'from'),
        _pullToPromise   || surfaceManager.buildSurface(targetSi, targetIi, 'to')
      ]);
    } catch (_) { cancelSlingshot(); return; }

    if (!fromSurf || !toSurf) { cancelSlingshot(); return; }

    try {
      await transitionKernel.runSlingshotRelease({
        pulledParticles: _pullParticles,
        pulledCanvasW:   _pullCanvasW,
        pulledCanvasH:   _pullCanvasH,
        fromSurface:     fromSurf,
        toSurface:       toSurf,
        onBeforeReveal:  async () => {
          _commitPosition(targetSi, targetIi);
          _commitView();
        }
      });

      _commitPosition(targetSi, targetIi);
      if (state.isGameActive && window.__SPA_GameNav) window.__SPA_GameNav.commitTo?.(state.si, state.ii);
      _activate(state.si, state.ii);
    } catch (_) {}

    _cleanupPull();
    _drainQueue();
  }

  function onCancel() { cancelSlingshot(); }

  function cancelSlingshot() {
    transitionKernel.hideCanvas();
    const heroEl = heroContainer.firstElementChild;
    if (heroEl) { heroEl.style.visibility = 'visible'; heroEl.style.opacity = '1'; heroEl.style.transition = ''; }
    _cleanupPull();
    _activate(state.si, state.ii);
  }

  function _cleanupPull() {
    _setPhase('idle');
    _pullTargetSi = null; _pullTargetIi = null;
    _pullFromSurface = null; _pullToSurface = null;
    _pullFromPromise = null; _pullToPromise = null;
    _pullParticles = null; _pullCanvasW = 0; _pullCanvasH = 0;
    transitionKernel.resetPullPreview();
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  function navigate(direction) {
    if (state.isGameActive && window.__SPA_GameNav) { void gameNavigate(direction); return; }
    const t = getTargetForDirection(direction, state.si, state.ii, state.homeSectionLocked);
    if (t) void goTo(t.sectionIdx, t.itemIdx);
  }

  // ─── Hero action handler ──────────────────────────────────────────────────

  function _handleHeroAction(clickAction) {
    if (window.__SPA_Overlay?.isOpen()) return;
    if (clickAction.startsWith('overlay:')) {
      void openOverlayWithTransition(clickAction.slice('overlay:'.length));
    } else {
      const safeUrl = getSafeExternalUrl(clickAction);
      if (safeUrl) {
        const w = window.open(safeUrl, '_blank', 'noopener,noreferrer');
        if (w) w.opener = null;
      }
    }
  }

  // ─── Queue drain ──────────────────────────────────────────────────────────

  function _drainQueue() {
    if (state.queuedTarget) {
      const q = state.queuedTarget; state.queuedTarget = null;
      void goTo(q.sectionIdx, q.itemIdx);
    }
  }

  function start(si = 0, ii = 0) {
    _commitPosition(si, ii);
    _commitView();
    _activate(state.si, state.ii);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    // Navigation
    goTo,
    navigate,
    // Slingshot
    onTap,
    onLock,
    onPull,
    onRelease,
    onCancel,
    cancelSlingshot,
    // Overlay
    openOverlayWithTransition,
    closeOverlayWithTransition,
    // Game mode
    enterCurrentGameWithTransition,
    exitGameToCurrentItem,
    gameNavigate,
    setGameActive(active) { state.isGameActive = !!active; _syncUiState(); },
    // State accessors
    getSi() { return state.si; },
    getIi() { return state.ii; },
    isTransitioning: _isTransitioning,
    // Hero action (used by heroRenderer onAction callback)
    onHeroAction: _handleHeroAction,
    // Render/lifecycle
    render: _render,
    start,
    // Window API helpers
    restoreCurrentItemHero() {
      _commitView(state.si, state.ii, { nav: false });
    }
  };
}
