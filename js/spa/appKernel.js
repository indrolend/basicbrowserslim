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
// Does NOT own: DOM structure, canvas, particle sampling, or rendering.

import { getSection, getItem, getClickAction, SLINGSHOT_MIN_RELEASE } from './spaData.js';
import { getSafeExternalUrl } from './utils.js';
import { getTargetForDirection } from './navModel.js';

export function createAppKernel({
  surfaceManager,
  transitionKernel,
  heroRenderer,
  navRenderer,
  rasterizeHero,
  heroContainer
}) {
  // ─── AppState ─────────────────────────────────────────────────────────────

  let _si = 0, _ii = 0;
  // 'idle' | 'transitioning' | 'pulling'
  let _phase = 'idle';

  let _homeSectionLocked   = false;
  let _isGameActive        = false;
  let _queuedTarget        = null;

  // Slingshot pull state
  let _pullTargetSi        = null, _pullTargetIi   = null;
  let _pullFromSurface     = null;
  let _pullFromPromise     = null, _pullToPromise  = null;
  let _pullParticles       = null;
  let _pullCanvasW         = 0,   _pullCanvasH    = 0;

  // ─── State helpers ────────────────────────────────────────────────────────

  function _isTransitioning() { return _phase !== 'idle'; }
  function _isPulling()       { return _phase === 'pulling'; }

  // Visible UI state contract: 'idle' | 'transitioning' | 'pulling' | 'overlay'
  function _computeUiState() {
    if (_phase !== 'idle') return _phase;
    return window.__SPA_Overlay?.isOpen?.() ? 'overlay' : 'idle';
  }

  function _syncUiState() {
    const section = getSection(_si);
    document.body.dataset.state = _computeUiState();
    document.body.dataset.section = section?.id ?? '';
    document.body.dataset.item = String(_ii);
  }

  function _setPhase(nextPhase) {
    _phase = nextPhase;
    _syncUiState();
  }

  function _render() {
    navRenderer.updateSectionNav(_si, _homeSectionLocked);
    navRenderer.updateItemDots(_si, _ii);
    heroRenderer.renderHeroDOM(_si, _ii);
    _syncUiState();
  }

  function _renderTarget(si, ii) {
    heroRenderer.renderHeroDOM(si, ii);
    navRenderer.updateSectionNav(si, _homeSectionLocked);
    navRenderer.updateItemDots(si, ii);
  }

  function _notifyView(si, ii, hookName) {
    const section = getSection(si);
    const item = getItem(si, ii);
    if (section && item) try { window.__SPA_Views?.[section.id]?.[hookName]?.(item.id); } catch (_) {}
  }

  async function _buildSurfacePair(fromSurfacePromise, toSurfacePromise) {
    try {
      const [fromSurface, toSurface] = await Promise.all([fromSurfacePromise, toSurfacePromise]);
      return { fromSurface, toSurface };
    } catch (_) {
      return { fromSurface: null, toSurface: null };
    }
  }

  async function _rasterizeProbeSurface(buildProbe) {
    const probe = buildProbe?.();
    if (!probe?.element) {
      probe?.cleanup?.();
      return null;
    }
    try {
      return await rasterizeHero({ type: 'textElement', element: probe.element });
    } catch (_) {
      return null;
    } finally {
      probe.cleanup?.();
    }
  }

  function _inferAutoPullVector(nextSi, nextIi) {
    if (nextSi === _si && nextIi === _ii) return { x: 1, y: 0 };
    if (nextSi === _si) return { x: nextIi > _ii ? 1 : -1, y: 0 };
    return { x: nextSi > _si ? 1 : -1, y: 0 };
  }

  async function _withTransition(run, opts = {}) {
    const {
      stopTracking = false,
      startTracking = false,
      drainQueue = false
    } = opts;
    _setPhase('transitioning');
    if (stopTracking) surfaceManager.stopTracking();
    try {
      await run();
    } finally {
      _setPhase('idle');
      if (startTracking) surfaceManager.startTracking(_si, _ii);
      if (drainQueue) _drainQueue();
    }
  }

  // ─── goTo ─────────────────────────────────────────────────────────────────

  async function goTo(nextSi, nextIi) {
    if (_homeSectionLocked && nextSi === 0 && _si !== 0) return;
    if (nextSi === _si && nextIi === _ii && !_isPulling()) return;
    if (_isTransitioning() || _isPulling()) {
      _queuedTarget = { sectionIdx: nextSi, itemIdx: nextIi };
      return;
    }

    await _withTransition(async () => {
      const fromSi = _si, fromIi = _ii;
      _notifyView(fromSi, fromIi, 'onDeactivate');

      const { fromSurface: fromSurf, toSurface: toSurf } = await _buildSurfacePair(
        surfaceManager.buildSurface(fromSi, fromIi, 'from'),
        surfaceManager.buildSurface(nextSi, nextIi, 'to')
      );

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
            if (nextSi !== 0 && !_homeSectionLocked) _homeSectionLocked = true;
            _renderTarget(nextSi, nextIi);
            didRenderDuringReveal = true;
          }
        });
      } finally {
        _si = nextSi; _ii = nextIi;
        _notifyView(nextSi, nextIi, 'onActivate');

        if (!didRenderDuringReveal) _render();
      }
    }, { stopTracking: true, startTracking: true, drainQueue: true });
  }

  // ─── Overlay lifecycle ────────────────────────────────────────────────────

  function _closeOverlayForNav() {
    window.__SPA_Overlay?.isOpen() && window.__SPA_Overlay.close({ restore: false });
  }

  async function openOverlayWithTransition(overlayId) {
    if (_isTransitioning() || _isPulling()) return;
    const overlay = window.__SPA_Overlay;
    if (!overlay) return;

    await _withTransition(async () => {
      const { fromSurface: fromSurf, toSurface: toSurf } = await _buildSurfacePair(
        surfaceManager.buildSurface(_si, _ii, 'from'),
        _rasterizeProbeSurface(() => overlay.buildProbe?.(overlayId, {}, { inline: true }))
      );

      if (!toSurf) {
        surfaceManager.startTracking(_si, _ii);
        overlay.open(overlayId);
        return;
      }

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => { overlay.openInline(overlayId, {}, heroContainer); }
      });
    }, { stopTracking: true });
  }

  async function closeOverlayWithTransition() {
    const overlay = window.__SPA_Overlay;
    if (!overlay?.isOpen() || _isTransitioning() || _isPulling()) return;

    await _withTransition(async () => {
      const { fromSurface: fromSurf, toSurface: toSurf } = await _buildSurfacePair(
        surfaceManager.buildSurface(_si, _ii, 'from'),
        surfaceManager.buildSurface(_si, _ii, 'to')
      );

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => { overlay.close({ restore: false }); heroRenderer.renderHeroDOM(_si, _ii); }
      });
    }, { startTracking: true });
  }

  // ─── Game mode lifecycle ──────────────────────────────────────────────────

  async function enterCurrentGameWithTransition() {
    if (_isTransitioning() || _isPulling()) return;
    const gameNav = window.__SPA_GameNav;
    if (!gameNav) return;

    await _withTransition(async () => {
      const { fromSurface: fromSurf, toSurface: toSurf } = await _buildSurfacePair(
        surfaceManager.buildSurface(_si, _ii, 'from'),
        _rasterizeProbeSurface(() => gameNav.buildHeroProbe?.(_si, _ii))
      );
      if (!toSurf) return;

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => {
          _isGameActive = true;
          window.__SPA_Views?.['games']?.mount?.('asymptote', heroContainer);
        }
      });
    }, { stopTracking: true });
  }

  async function exitGameToCurrentItem() {
    if (_isTransitioning() || _isPulling()) return;

    await _withTransition(async () => {
      const { fromSurface: fromSurf, toSurface: toSurf } = await _buildSurfacePair(
        surfaceManager.buildSurface(_si, _ii, 'from'),
        surfaceManager.buildSurface(_si, _ii, 'to')
      );

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => { _isGameActive = false; heroRenderer.renderHeroDOM(_si, _ii); }
      });
    }, { startTracking: true });
  }

  async function gameNavigate(direction) {
    const gameNav = window.__SPA_GameNav;
    if (!gameNav || _isTransitioning() || _isPulling()) return;
    const from = gameNav.getFromTarget?.();
    const to   = gameNav.getToTarget?.(direction);
    if (!from || !to) return;

    await _withTransition(async () => {
      const { fromSurface: fromSurf, toSurface: toSurf } = await _buildSurfacePair(
        _rasterizeProbeSurface(() => gameNav.buildHeroProbe?.(from.sectionIdx, from.itemIdx)),
        _rasterizeProbeSurface(() => gameNav.buildHeroProbe?.(to.sectionIdx, to.itemIdx))
      );
      if (!fromSurf || !toSurf) return;

      await transitionKernel.runTransition(fromSurf, toSurf, {
        onBeforeReveal: async () => {
          _si = to.sectionIdx;
          _ii = to.itemIdx;
          gameNav.commitTo?.(_si, _ii);
          _renderTarget(_si, _ii);
          _syncUiState();
        }
      });
    });
  }

  // ─── Slingshot callbacks ──────────────────────────────────────────────────

  function onTap() {
    if (window.__SPA_Overlay?.shouldSuppressTap?.()) return;
    if (window.__SPA_Overlay?.isOpen()) { void closeOverlayWithTransition(); return; }
    if (_isGameActive) { window.__SPA_GameNav?.onTap?.(); return; }
    const action = getClickAction(_si, _ii);
    if (action) _handleHeroAction(action);
  }

  function onLock({ direction }) {
    if (_phase === 'transitioning') {
      const t = getTargetForDirection(direction, _si, _ii, _homeSectionLocked);
      if (t) _queuedTarget = { sectionIdx: t.sectionIdx, itemIdx: t.itemIdx };
      return false;
    }
    if (_isPulling()) return false;

    let targetSi, targetIi;
    if (_isGameActive && window.__SPA_GameNav) {
      const t = window.__SPA_GameNav.getToTarget?.(direction);
      if (!t) return false;
      targetSi = t.sectionIdx; targetIi = t.itemIdx;
    } else {
      const t = getTargetForDirection(direction, _si, _ii, _homeSectionLocked);
      if (!t) return false;
      targetSi = t.sectionIdx; targetIi = t.itemIdx;
    }

    _pullTargetSi = targetSi;
    _pullTargetIi = targetIi;
    _setPhase('pulling');
    transitionKernel.resetPullPreview();
    _pullParticles = null;

    // Build surfaces in parallel while the user is pulling
    const fp = surfaceManager.buildSurface(_si, _ii, 'from');
    const tp = surfaceManager.buildSurface(targetSi, targetIi, 'to');
    _pullFromPromise = fp;
    _pullToPromise   = tp;
    fp.then(s => { if (_pullFromPromise === fp) _pullFromSurface = s; }).catch(() => {});
    tp.catch(() => {});

    surfaceManager.stopTracking();
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
        _pullFromPromise || surfaceManager.buildSurface(_si, _ii, 'from'),
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
          _renderTarget(targetSi, targetIi);
        }
      });

      _si = targetSi; _ii = targetIi;
      if (_isGameActive && window.__SPA_GameNav) window.__SPA_GameNav.commitTo?.(_si, _ii);

      _notifyView(_si, _ii, 'onActivate');
    } catch (_) {}

    _cleanupPull();
    surfaceManager.startTracking(_si, _ii);
    _drainQueue();
  }

  function onCancel() { cancelSlingshot(); }

  function cancelSlingshot() {
    transitionKernel.hideCanvas();
    const heroEl = heroContainer.firstElementChild;
    if (heroEl) { heroEl.style.visibility = 'visible'; heroEl.style.opacity = '1'; heroEl.style.transition = ''; }
    _cleanupPull();
    surfaceManager.startTracking(_si, _ii);
    _notifyView(_si, _ii, 'onActivate');
  }

  function _cleanupPull() {
    _setPhase('idle');
    _pullTargetSi = null; _pullTargetIi = null;
    _pullFromSurface = null;
    _pullFromPromise = null; _pullToPromise = null;
    _pullParticles = null; _pullCanvasW = 0; _pullCanvasH = 0;
    transitionKernel.resetPullPreview();
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  function navigate(direction) {
    if (_isGameActive && window.__SPA_GameNav) { void gameNavigate(direction); return; }
    const t = getTargetForDirection(direction, _si, _ii, _homeSectionLocked);
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
    if (_queuedTarget) {
      const q = _queuedTarget; _queuedTarget = null;
      void goTo(q.sectionIdx, q.itemIdx);
    }
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
    setGameActive(active) { _isGameActive = !!active; _syncUiState(); },
    // State accessors
    getSi() { return _si; },
    getIi() { return _ii; },
    isTransitioning: _isTransitioning,
    // Hero action (used by heroRenderer onAction callback)
    onHeroAction: _handleHeroAction,
    // Render
    render: _render,
    // Window API helpers
    restoreCurrentItemHero() {
      heroRenderer.renderHeroDOM(_si, _ii);
      surfaceManager.startTracking(_si, _ii);
      _syncUiState();
    }
  };
}
