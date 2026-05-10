// appKernel.js — application state machine, orchestration, and render authority
//
// Canonical state authority, navigation, surface building, and render commits.
//
// Owns:
//   - AppState (position, transition phase, pull state, game mode, queued nav)
//   - Navigation computation
//   - Surface rasterization input building
//   - Hero and nav rendering
//   - GIF player lifecycle
//   - Overlay lifecycle
//   - Game mode lifecycle
//   - Slingshot gesture callbacks
//   - Hero action dispatch
//   - All render commit authority
//
// Minimal delegation: canvas animation (transitionKernel), particle physics (particleEngine),
// hero rasterization (rasterizeHero), and lazy runtime loading.

import { SPA_SECTIONS, getSection, getItem, getHeroSpec, getClickAction, SLINGSHOT_MIN_RELEASE } from './spaData.js';
import { getSafeExternalUrl } from './utils.js';
import { ensureOverlayRuntime, ensureSectionRuntime, ensureGifRuntime } from './runtimeModules.js';

export function createAppKernel({
  transitionKernel,
  rasterizeHero,
  heroContainer,
  dotsContainer,
  overlayRoot
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
    queuedTarget: null
  };

  // Slingshot pull state
  let _pullTargetSi        = null, _pullTargetIi   = null;
  let _pullFromSurface     = null, _pullToSurface  = null;
  let _pullFromPromise     = null, _pullToPromise  = null;
  let _pullParticles       = null;
  let _pullCanvasW         = 0,   _pullCanvasH    = 0;

  // ─── Render state ─────────────────────────────────────────────────────────

  let _sectionNav          = document.getElementById('spa-section-nav');
  let _activeGifPlayer     = null;
  let _gifRestartSeq       = 0;

  // ─── GIF momentum state ───────────────────────────────────────────────────
  // Signed float -1..+1: positive = pull toward next, negative = pull toward prev.
  // Consumed by _renderHeroDOM once per slingshot release.
  let _momentumFactor      = 0;
  let _gifMomentumCancel   = null; // cancels an active frame-delay decay loop

  // ─── State helpers ────────────────────────────────────────────────────────

  function _isTransitioning() { return state.phase !== 'idle'; }
  function _isPulling()       { return state.phase === 'pulling'; }

  // ─── Navigation helpers ───────────────────────────────────────────────────

  function _getAvailableSections(homeSectionLocked) {
    return homeSectionLocked ? SPA_SECTIONS.filter((_, i) => i !== 0) : SPA_SECTIONS;
  }

  function _getNextTarget(si, ii, homeSectionLocked) {
    const section = getSection(si);
    if (!section) return null;
    if (ii + 1 < section.items.length) return { sectionIdx: si, itemIdx: ii + 1 };
    const avail = _getAvailableSections(homeSectionLocked);
    const pos   = avail.findIndex(s => s === section);
    const next  = avail[(pos + 1) % avail.length];
    return { sectionIdx: SPA_SECTIONS.indexOf(next), itemIdx: 0 };
  }

  function _getPrevTarget(si, ii, homeSectionLocked) {
    const section = getSection(si);
    if (!section) return null;
    if (ii - 1 >= 0) return { sectionIdx: si, itemIdx: ii - 1 };
    const avail = _getAvailableSections(homeSectionLocked);
    const pos   = avail.findIndex(s => s === section);
    const prev  = avail[(pos - 1 + avail.length) % avail.length];
    const prevSi = SPA_SECTIONS.indexOf(prev);
    return { sectionIdx: prevSi, itemIdx: SPA_SECTIONS[prevSi].items.length - 1 };
  }

  function _getTargetForDirection(direction, si, ii, homeSectionLocked) {
    return direction === 'next'
      ? _getNextTarget(si, ii, homeSectionLocked)
      : _getPrevTarget(si, ii, homeSectionLocked);
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  function _getSectionNav() {
    if (!_sectionNav) {
      _sectionNav = document.createElement('nav');
      _sectionNav.id = 'spa-section-nav';
      _sectionNav.setAttribute('aria-label', 'Sections');
      document.body.insertBefore(_sectionNav, document.body.firstChild);
    }
    return _sectionNav;
  }

  function _renderSectionNav(si, homeSectionLocked) {
    const nav = _getSectionNav();
    nav.innerHTML = '';
    const sectionsToShow = homeSectionLocked
      ? SPA_SECTIONS.filter((_, i) => i !== 0)
      : SPA_SECTIONS;
    for (const section of sectionsToShow) {
      const idx = SPA_SECTIONS.indexOf(section);
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'spa-nav-btn';
      btn.textContent = section.label;
      if (idx === si) {
        btn.style.fontWeight = 'bold';
        btn.style.background = '#333';
        btn.setAttribute('aria-current', 'page');
      }
      btn.dataset.action = 'goto-section';
      btn.dataset.sectionIdx = String(idx);
      nav.appendChild(btn);
    }
  }

  function _renderItemDots(si, ii) {
    dotsContainer.innerHTML = '';
    const section = getSection(si);
    if (!section || section.items.length <= 1) return;
    section.items.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'spa-dot';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', item.label);
      btn.setAttribute('aria-selected', idx === ii ? 'true' : 'false');
      btn.dataset.action = 'goto-item';
      btn.dataset.sectionIdx = String(si);
      btn.dataset.itemIdx = String(idx);
      dotsContainer.appendChild(btn);
    });
  }

  function _isGifSrc(src) {
    return /\.gif(?:[?#]|$)/i.test(src || '');
  }

  function _buildRestartGifSrc(src) {
    const raw = String(src || '');
    if (!raw) return raw;
    const hashIndex = raw.indexOf('#');
    const base = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
    const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
    const sep = base.includes('?') ? '&' : '?';
    _gifRestartSeq += 1;
    return `${base}${sep}spa_gif_restart=${Date.now()}_${_gifRestartSeq}${hash}`;
  }

  // ─── GIF frame-rate momentum ─────────────────────────────────────────────
  //
  // After a slingshot release onto a GIF hero, we:
  //   1. Swap the visible element from <img> (native, uncontrollable) to the
  //      gifCanvas (gifler-driven, delay-controllable).
  //   2. Temporarily compress frame delays by Math.pow(2, -factor), where
  //      factor is magnitude-only in [0, 1].
  //   3. Run a rAF decay loop until |factor| < 0.02, then restore original
  //      delays but keep rendering on the same canvas surface.
  //
  function _startGifMomentum(animator, gifCanvas, img, factor) {
    if (_gifMomentumCancel) { _gifMomentumCancel(); _gifMomentumCancel = null; }
    const frames = animator._frames;
    if (!frames || !frames.length) return;

    // Clamp factor to [0, 1]: magnitude-only cadence compression.
    // Direction does not affect timing sign in this patch.
    const clampedFactor = Math.max(0, Math.min(1, Math.abs(factor)));

    // Snapshot original frame delays (gifler stores delay in centiseconds).
    const origDelays = frames.map(f => f.delay);

    let current = clampedFactor;
    let rafId;
    let swapped = false;

    function applyDelays(f) {
      const amount = Math.max(0, Math.min(1, Math.abs(f)));
      const curved = Math.pow(amount, 0.75);
      const mul = Math.max(0.3, Math.pow(3, -curved));
      for (let i = 0; i < frames.length; i++) {
        frames[i].delay = Math.max(1, Math.round(origDelays[i] * mul));
      }
    }

    // Swap display from native <img> (uncontrollable speed) to gifCanvas.
    // Waits for gifCanvas._gifReady so the first drawn frame is already there.
    // Uses .spa-hero-image class so sizing/border-radius matches the img exactly.
    function swapIn() {
      img.style.display = 'none';
      gifCanvas.style.cssText = ''; // clear position:absolute;left:-9999px override
      gifCanvas.classList.add('spa-hero-image');
      swapped = true;
    }

    function swapOut() {
      if (!swapped) return;
      gifCanvas.classList.remove('spa-hero-image');
      gifCanvas.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;';
      if (img.isConnected) img.style.display = '';
      swapped = false;
    }

    function restoreDelays() {
      for (let i = 0; i < frames.length; i++) frames[i].delay = origDelays[i];
    }

    function tick() {
      if (!animator._running || !gifCanvas.isConnected) {
        restoreDelays(); swapOut(); _gifMomentumCancel = null; return;
      }
      // Wait for gifler to render at least one frame before swapping to canvas.
      if (!swapped) {
        if (gifCanvas._gifReady) swapIn();
        rafId = requestAnimationFrame(tick);
        return;
      }
      if (Math.abs(current) < 0.02) {
        // End momentum without a canvas->img handoff. Keeping the same visual
        // surface avoids endpoint duplication caused by unsynced playback sources.
        restoreDelays();
        _gifMomentumCancel = () => { restoreDelays(); swapOut(); _gifMomentumCancel = null; };
        return;
      }
      current *= 0.93;
      applyDelays(current);
      rafId = requestAnimationFrame(tick);
    }

    // Apply initial delay scaling immediately so timing starts before swap.
    applyDelays(current);
    rafId = requestAnimationFrame(tick);
    _gifMomentumCancel = () => { cancelAnimationFrame(rafId); restoreDelays(); swapOut(); _gifMomentumCancel = null; };
  }

  function _renderHeroDOM(si, ii) {
    // Cancel any running momentum decay before wiping the container.
    if (_gifMomentumCancel) { _gifMomentumCancel(); _gifMomentumCancel = null; }
    // Stop the gifler player we own before wiping the container
    if (_activeGifPlayer) {
      try { _activeGifPlayer.stop(); } catch (_) {}
      _activeGifPlayer = null;
    }
    heroContainer.innerHTML = '';

    const section = getSection(si);
    const item    = getItem(si, ii);
    if (!section || !item) return;

    // Delegate to external view module if registered
    const viewModule = window.__SPA_Views?.[section.id];
    if (viewModule?.mount) { viewModule.mount(item.id, heroContainer); return; }

    const heroSpec    = getHeroSpec(si, ii);
    const clickAction = getClickAction(si, ii);

    const wrapper = document.createElement('div');
    wrapper.className = 'spa-hero';
    wrapper.setAttribute('draggable', 'false');
    wrapper.addEventListener('dragstart', (e) => e.preventDefault());

    if (clickAction) {
      wrapper.classList.add('spa-hero--linkable');
      wrapper.setAttribute('role', 'link');
      wrapper.setAttribute('tabindex', '0');
      wrapper.dataset.action = 'hero-action';
      wrapper.dataset.clickAction = clickAction;
    }

    if (heroSpec.kind === 'image') {
      if (_isGifSrc(heroSpec.src)) {
        const gifRenderSrc = _buildRestartGifSrc(heroSpec.src);
        const img = document.createElement('img');
        img.className = 'spa-hero-image';
        img.src       = gifRenderSrc;
        img.width     = 320;
        img.height    = 320;
        img.style.objectFit = 'contain';
        img.setAttribute('draggable', 'false');
        wrapper.appendChild(img);

        const gifCanvas = document.createElement('canvas');
        gifCanvas.className = 'spa-hero-canvas';
        gifCanvas.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;';
        gifCanvas._gifReady = false;
        wrapper.appendChild(gifCanvas);
        const capturedMomentum = _momentumFactor;
        _momentumFactor = 0;
        ensureGifRuntime().then(() => {
          if (!gifCanvas.isConnected || typeof window.gifler !== 'function') return;
          window.gifler(gifRenderSrc).get(function(animator) {
            if (!gifCanvas.isConnected) {
              try { animator.stop(); } catch (_) {}
              return;
            }
            animator.onDrawFrame = function(ctx, frame) {
              if (!frame?.buffer) return;
              ctx.drawImage(frame.buffer, frame.x, frame.y);
              gifCanvas._gifReady = true;
            };
            animator.animateInCanvas(gifCanvas);
            _activeGifPlayer = animator;
            // Start frame-rate momentum decay if a slingshot released into this hero.
            if (capturedMomentum !== 0) {
              _startGifMomentum(animator, gifCanvas, img, capturedMomentum);
            }
          });
        }).catch(() => {});
      } else {
        const img = document.createElement('img');
        img.className = 'spa-hero-image';
        img.src       = heroSpec.src;
        img.width     = 320;
        img.height    = 320;
        img.style.objectFit = 'contain';
        img.setAttribute('draggable', 'false');
        wrapper.appendChild(img);
      }
    } else {
      wrapper.classList.add('spa-hero--text');
      const textEl = document.createElement('div');
      textEl.className   = 'spa-hero-text';
      textEl.textContent = heroSpec.text || item.label;
      wrapper.appendChild(textEl);
    }

    heroContainer.appendChild(wrapper);
  }

  function _buildRenderInput(si, ii, phase) {
    const section = getSection(si);
    const item    = getItem(si, ii);
    if (!section || !item) return null;

    const heroSpec   = getHeroSpec(si, ii);
    const viewModule = window.__SPA_Views?.[section.id];

    if (phase === 'from') {
      // GIF hero rendered by gifler — canvas holds the current frame once ready
      const liveGifCanvas = heroContainer.querySelector('canvas.spa-hero-canvas');
      if (liveGifCanvas && liveGifCanvas._gifReady === true && liveGifCanvas.width > 0 && liveGifCanvas.height > 0) {
        return { type: 'element', element: liveGifCanvas };
      }

      // Live hero element in DOM
      const liveImg = heroContainer.querySelector('.spa-hero-image');
      if (liveImg) return { type: 'element', element: liveImg };

      const liveHero = heroContainer.querySelector('.spa-hero');
      if (liveHero) return { type: 'textElement', element: liveHero };

      // Overlay inline element
      if (overlayRoot?.style.display !== 'none') {
        const inlineEl = overlayRoot.querySelector('.spa-overlay--inline');
        if (inlineEl) return { type: 'textElement', element: inlineEl };
      }

      // View probe
      if (viewModule?.buildHeroProbe) {
        const probe = viewModule.buildHeroProbe(item.id, heroContainer);
        if (probe) return { type: 'textElement', element: probe.element, cleanup: probe.cleanup };
      }

      if (heroSpec.kind === 'image') return { type: 'gif', src: heroSpec.src };
      return { type: 'text', text: heroSpec.text || item.label };
    }

    // phase === 'to'
    if (heroSpec.kind === 'image') return { type: 'gif', src: heroSpec.src };

    if (viewModule?.buildHeroProbe) {
      const probe = viewModule.buildHeroProbe(item.id, heroContainer);
      if (probe) return { type: 'textElement', element: probe.element, cleanup: probe.cleanup };
    }

    // Build an offscreen probe that mirrors renderHeroDOM for text heroes
    const probeWrap = document.createElement('div');
    probeWrap.className = 'spa-hero spa-hero--text';
    probeWrap.style.cssText =
      `position:absolute;left:-9999px;top:0;` +
      `width:${heroContainer.offsetWidth || 320}px;pointer-events:none;`;
    const probeText = document.createElement('div');
    probeText.className = 'spa-hero-text';
    probeText.textContent = heroSpec.text || item.label;
    probeWrap.appendChild(probeText);
    document.body.appendChild(probeWrap);
    return { type: 'textElement', element: probeWrap, cleanup: () => probeWrap.remove() };
  }

  async function _buildSurface(si, ii, phase) {
    const input = _buildRenderInput(si, ii, phase);
    if (!input) return null;
    try {
      const surface = await rasterizeHero(input);
      if (input.cleanup) input.cleanup();
      return surface;
    } catch (_) {
      if (input.cleanup) input.cleanup();
      return null;
    }
  }

  function _setPhase(nextPhase) {
    state.phase = nextPhase;
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

  function _commitPositionAndView(si, ii, viewOptions) {
    _commitPosition(si, ii);
    _commitView(si, ii, viewOptions);
  }

  function _commitView(si = state.si, ii = state.ii, { hero = true, nav = true } = {}) {
    if (hero) _renderHeroDOM(si, ii);
    if (nav) {
      _renderSectionNav(si, state.homeSectionLocked);
      _renderItemDots(si, ii);
    }
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

  async function _withRevealCommit(run, commit, fallbackCommit = null) {
    let committedDuringReveal = false;
    try {
      await run(async () => {
        await commit();
        committedDuringReveal = true;
      });
    } finally {
      if (!committedDuringReveal && fallbackCommit) await fallbackCommit();
    }
    return committedDuringReveal;
  }

  async function _buildSurfacePair(fromTask, toTask) {
    try {
      return await Promise.all([fromTask(), toTask()]);
    } catch (_) {
      return [null, null];
    }
  }

  async function _rasterizeProbeSurface(probe) {
    if (!probe) return null;
    try {
      document.body.appendChild(probe.element);
      return await rasterizeHero({ type: 'textElement', element: probe.element });
    } catch (_) {
      return null;
    } finally {
      probe.cleanup?.();
    }
  }

  async function _runSubsystemTransform({ fromTask, toTask, reveal, fallback = null }) {
    const [fromSurf, toSurf] = await _buildSurfacePair(fromTask, toTask);
    if (!fromSurf || !toSurf) {
      // Continuity rule: missing sampled surfaces should not suppress reveal.
      // Callers can override with an explicit fallback when reveal is unsafe.
      if (fallback) await fallback();
      else await reveal();
      return false;
    }

    await transitionKernel.runTransition(fromSurf, toSurf, {
      onBeforeReveal: async () => {
        await reveal();
      }
    });
    return true;
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

      const [fromSurf, toSurf] = await _buildSurfacePair(
        () => _buildSurface(fromSi, fromIi, 'from'),
        () => _buildSurface(nextSi, nextIi, 'to')
      );

      try {
        await _withRevealCommit((onBeforeReveal) => transitionKernel.runSlingshotRelease({
          pulledParticles: null,
          pulledCanvasW: 0,
          pulledCanvasH: 0,
          fromSurface: fromSurf,
          toSurface: toSurf,
          autoPullVector: _inferAutoPullVector(nextSi, nextIi),
          onBeforeReveal: async () => {
            if (window.__SPA_Overlay?.isOpen()) window.__SPA_Overlay.close({ restore: false });
            if (nextSi !== 0 && !state.homeSectionLocked) state.homeSectionLocked = true;
            await onBeforeReveal();
          }
        }), () => _commitPositionAndView(nextSi, nextIi), () => _commitPositionAndView(nextSi, nextIi));
      } finally {
        _activate(nextSi, nextIi);
      }
    }, { drainQueue: true });
  }

  // ─── Overlay lifecycle ────────────────────────────────────────────────────

  async function openOverlayWithTransition(overlayId) {
    if (_isTransitioning() || _isPulling()) return;
    await ensureOverlayRuntime().catch(() => {});
    const overlay = window.__SPA_Overlay;
    if (!overlay) return;

    const probe = overlay.buildProbe?.(overlayId, {}, { inline: true });
    if (!probe) { overlay.open(overlayId); return; }

    await _withTransition(async () => {
      await _runSubsystemTransform({
        fromTask: () => _buildSurface(state.si, state.ii, 'from'),
        toTask: () => _rasterizeProbeSurface(probe),
        reveal: async () => {
          overlay.openInline(overlayId, {}, heroContainer);
        },
        fallback: async () => {
          overlay.open(overlayId);
        }
      });
    });
  }

  async function closeOverlayWithTransition() {
    const overlay = window.__SPA_Overlay;
    if (!overlay?.isOpen() || _isTransitioning() || _isPulling()) return;

    await _withTransition(async () => {
      await _runSubsystemTransform({
        fromTask: () => _buildSurface(state.si, state.ii, 'from'),
        toTask: () => _buildSurface(state.si, state.ii, 'to'),
        reveal: async () => {
          overlay.close({ restore: false });
          _commitView(state.si, state.ii, { nav: false });
        }
      });
    });
  }

  // ─── Slingshot callbacks ──────────────────────────────────────────────────

  function onTap() {
    if (window.__SPA_Overlay?.shouldSuppressTap?.()) return;
    if (window.__SPA_Overlay?.isOpen()) { void closeOverlayWithTransition(); return; }
    const action = getClickAction(state.si, state.ii);
    if (action) _handleHeroAction(action);
  }

  function onLock({ direction }) {
    if (state.phase === 'transitioning') {
      const t = _getTargetForDirection(direction, state.si, state.ii, state.homeSectionLocked);
      if (t) state.queuedTarget = { sectionIdx: t.sectionIdx, itemIdx: t.itemIdx };
      return false;
    }
    if (_isPulling()) return false;

    let targetSi, targetIi;
    const t = _getTargetForDirection(direction, state.si, state.ii, state.homeSectionLocked);
    if (!t) return false;
    targetSi = t.sectionIdx; targetIi = t.itemIdx;

    _pullTargetSi = targetSi;
    _pullTargetIi = targetIi;
    _momentumFactor = 0;
    _setPhase('pulling');
    transitionKernel.resetPullPreview();
    _pullParticles = null;

    // Build surfaces in parallel while the user is pulling
    const fp = _ensureRuntimeFor(state.si).then(() => _buildSurface(state.si, state.ii, 'from'));
    const tp = _ensureRuntimeFor(targetSi).then(() => _buildSurface(targetSi, targetIi, 'to'));
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
    // Track pull force magnitude for GIF frame cadence compression on reveal.
    // Direction is intentionally ignored; both directions accelerate first.
    if (Math.abs(pullVector.x) > 0.1) {
      _momentumFactor = Math.max(0, Math.min(1, pullNormalized));
    }
  }

  async function onRelease({ pullNormalized }) {
    if (pullNormalized < SLINGSHOT_MIN_RELEASE) { cancelSlingshot(); return; }

    const targetSi = _pullTargetSi, targetIi = _pullTargetIi;

    const [fromSurf, toSurf] = await _buildSurfacePair(
      () => _pullFromPromise || _buildSurface(state.si, state.ii, 'from'),
      () => _pullToPromise || _buildSurface(targetSi, targetIi, 'to')
    );

    if (!fromSurf || !toSurf) { cancelSlingshot(); return; }

    try {
      await _withRevealCommit((onBeforeReveal) => transitionKernel.runSlingshotRelease({
        pulledParticles: _pullParticles,
        pulledCanvasW:   _pullCanvasW,
        pulledCanvasH:   _pullCanvasH,
        fromSurface:     fromSurf,
        toSurface:       toSurf,
        onBeforeReveal:  async () => {
          await onBeforeReveal();
        }
      }), () => _commitPositionAndView(targetSi, targetIi), () => _commitPositionAndView(targetSi, targetIi));
      _activate(state.si, state.ii);
    } catch (_) {}

    _cleanupPull();
    _drainQueue();
  }

  function onCancel() { cancelSlingshot(); }

  function cancelSlingshot() {
    _momentumFactor = 0;
    if (_gifMomentumCancel) { _gifMomentumCancel(); _gifMomentumCancel = null; }
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
    const t = _getTargetForDirection(direction, state.si, state.ii, state.homeSectionLocked);
    if (t) void goTo(t.sectionIdx, t.itemIdx);
  }

  function dispatchInputIntent(intent, payload = {}) {
    if (intent === 'navigate') {
      const direction = payload.direction;
      if (direction === 'prev' || direction === 'next') navigate(direction);
      return;
    }

    if (intent === 'goto') {
      const sectionIdx = payload.sectionIdx;
      const itemIdx = payload.itemIdx;
      if (Number.isInteger(sectionIdx) && Number.isInteger(itemIdx)) void goTo(sectionIdx, itemIdx);
      return;
    }

    if (intent === 'hero-action') {
      const clickAction = payload.clickAction;
      if (typeof clickAction === 'string' && clickAction.length > 0) _handleHeroAction(clickAction);
      return;
    }

    if (intent === 'close-overlay') {
      void closeOverlayWithTransition();
      return;
    }

    if (intent === 'restore-current-item-hero') {
      _commitView(state.si, state.ii, { nav: false });
      return;
    }

    if (intent === 'cancel-slingshot') {
      cancelSlingshot();
    }
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
    dispatchInputIntent,
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
    // State accessors
    getSi() { return state.si; },
    getIi() { return state.ii; },
    isTransitioning: _isTransitioning,
    // Hero action (used by heroRenderer onAction callback)
    onHeroAction: _handleHeroAction,
    // Lifecycle
    start,
    // Window API helpers
    restoreCurrentItemHero() {
      _commitView(state.si, state.ii, { nav: false });
    }
  };
}
