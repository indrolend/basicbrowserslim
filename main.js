// ─── Module imports ───────────────────────────────────────────────────────────
import { rasterizeHero }                  from './js/spa/rasterizeHero.js';
import { transition, transitionFromPull } from './js/spa/particleTransitionEngine.js';
import { initSlingshot }                  from './js/spa/slingshotGesture.js';
import { getSection, getItem, getClickAction,
         SLINGSHOT_MIN_RELEASE, REVEAL_HANDOFF_FADE_MS } from './js/spa/spaData.js';
import { getSafeExternalUrl, waitRaf, waitMs }            from './js/spa/utils.js';
import { getNextTarget, getPrevTarget, getTargetForDirection,
         createDesktopNavTracker }                        from './js/spa/navModel.js';
import { createNavRenderer }                              from './js/spa/renderNav.js';
import { createHeroRenderer }                             from './js/spa/renderHero.js';
import { createHeroSurface }                              from './js/spa/heroSurface.js';
import { createTransitionRunner }                         from './js/spa/transitionRunner.js';
import { createSlingshotPreview }                         from './js/spa/slingshotPreview.js';

// ─── DOM ──────────────────────────────────────────────────────────────────────

const heroContainer    = document.getElementById('spa-hero-container');
const transitionCanvas = document.getElementById('transition-canvas');
const transitionCtx    = transitionCanvas.getContext('2d');
const dotsContainer    = document.getElementById('spa-dots');

// ─── State ────────────────────────────────────────────────────────────────────

let currentSectionIdx = 0, currentItemIdx = 0;
let isTransitioning = false, isPulling = false;
let queuedTarget = null, activeTarget = null;
let homeSectionLocked = false;
let isAsymptoteGameActive = false;

// Slingshot pull state
let pullTargetSectionIdx = null, pullTargetItemIdx = null;
let pullFromSurface = null, pullToSurface = null;
let pullFromSurfacePromise = null, pullToSurfacePromise = null;
let pullPreviewParticles = null;
let pullPreviewCanvasW = 0, pullPreviewCanvasH = 0;

// ─── Module instances ─────────────────────────────────────────────────────────

const desktopNav = createDesktopNavTracker();

const heroSurface = createHeroSurface({
  heroContainer,
  rasterizeHero,
  getIsTransitioning: () => isTransitioning
});

const runner = createTransitionRunner({
  transitionCanvas, transitionCtx, heroContainer, transition
});

const slingshotPreview = createSlingshotPreview({ transitionCanvas, transitionCtx });

const heroRenderer = createHeroRenderer({
  heroContainer,
  onAction: (clickAction) => handleHeroAction(clickAction)
});

const navRenderer = createNavRenderer({
  dotsContainer,
  onNav: (si, ii) => goTo(si, ii)
});

// ─── Window API ───────────────────────────────────────────────────────────────

window.__SPA_SetGameMode = (active) => { isAsymptoteGameActive = !!active; };

window.__SPA_GoHome = () => goTo(0, 0);

window.__SPA_ExitGameToCurrentItem = () => void exitGameToCurrentItem();

window.__SPA_EnterCurrentGame = () => void enterCurrentGameWithTransition();

window.__SPA_RestoreCurrentItemHero = () => {
  heroRenderer.renderHeroDOM(currentSectionIdx, currentItemIdx);
  heroSurface.startTracking(currentSectionIdx, currentItemIdx);
};

window.__SPA_CloseCurrentOverlayWithTransition = () => void closeOverlayWithTransition();

window.__SPA_CancelSlingshot = () => cancelSlingshot();

// ─── Hero action handler ──────────────────────────────────────────────────────

function handleHeroAction(clickAction) {
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

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  navRenderer.updateSectionNav(currentSectionIdx, homeSectionLocked);
  navRenderer.updateItemDots(currentSectionIdx, currentItemIdx);
  heroRenderer.renderHeroDOM(currentSectionIdx, currentItemIdx);
}

// ─── goTo ─────────────────────────────────────────────────────────────────────

async function goTo(nextSi, nextIi, navOpts = {}) {
  if (homeSectionLocked && nextSi === 0 && currentSectionIdx !== 0) return;
  if (nextSi === currentSectionIdx && nextIi === currentItemIdx && !isPulling) return;
  if (isTransitioning || isPulling) { queuedTarget = { sectionIdx: nextSi, itemIdx: nextIi, navOpts }; return; }

  const fromSi = currentSectionIdx, fromIi = currentItemIdx;
  isTransitioning = true;
  activeTarget    = { sectionIdx: nextSi, itemIdx: nextIi };
  heroSurface.stopTracking();

  // Deactivate outgoing view
  const outSection = getSection(fromSi), outItem = getItem(fromSi, fromIi);
  if (outSection && outItem) try { window.__SPA_Views?.[outSection.id]?.onDeactivate?.(outItem.id); } catch (_) {}

  let fromSurf, toSurf;
  try { [fromSurf, toSurf] = await Promise.all([heroSurface.buildHeroSurface(fromSi, fromIi, 'from'), heroSurface.buildHeroSurface(nextSi, nextIi, 'to')]); } catch (_) {}

  let didRenderDuringReveal = false;
  try {
    await runner.runHeroTransition(fromSurf, toSurf, {
      ...navOpts,
      onBeforeReveal: async () => {
        closeOverlayForNav();
        if (nextSi !== 0 && !homeSectionLocked) homeSectionLocked = true;
        heroRenderer.renderHeroDOM(nextSi, nextIi);
        navRenderer.updateSectionNav(nextSi, homeSectionLocked);
        navRenderer.updateItemDots(nextSi, nextIi);
        didRenderDuringReveal = true;
      }
    });
  } finally {
    currentSectionIdx = nextSi;
    currentItemIdx    = nextIi;
    activeTarget      = null;

    const inSection = getSection(nextSi), inItem = getItem(nextSi, nextIi);
    if (inSection && inItem) try { window.__SPA_Views?.[inSection.id]?.onActivate?.(inItem.id); } catch (_) {}

    if (!didRenderDuringReveal) render();

    isTransitioning = false;
    heroSurface.startTracking(currentSectionIdx, currentItemIdx);

    if (queuedTarget) {
      const q = queuedTarget; queuedTarget = null;
      void goTo(q.sectionIdx, q.itemIdx, q.navOpts || {});
    }
  }
}

// ─── Overlay integration ──────────────────────────────────────────────────────

function closeOverlayForNav() {
  window.__SPA_Overlay?.isOpen() && window.__SPA_Overlay.close({ restore: false });
}

async function openOverlayWithTransition(overlayId) {
  if (isTransitioning || isPulling) return;
  const overlay = window.__SPA_Overlay;
  if (!overlay) return;

  const probe = overlay.buildProbe?.(overlayId, {}, { inline: true });
  if (!probe) { overlay.open(overlayId); return; }

  isTransitioning = true;
  heroSurface.stopTracking();

  let fromSurf, toSurf;
  try {
    document.body.appendChild(probe.element);
    [fromSurf, toSurf] = await Promise.all([
      heroSurface.buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'),
      rasterizeHero({ type: 'textElement', element: probe.element })
    ]);
  } catch (_) {
    probe.cleanup?.(); isTransitioning = false;
    heroSurface.startTracking(currentSectionIdx, currentItemIdx);
    overlay.open(overlayId); return;
  }

  try {
    await runner.runHeroTransition(fromSurf, toSurf, {
      onBeforeReveal: async () => { probe.cleanup?.(); overlay.openInline(overlayId, {}, heroContainer); }
    });
  } finally { isTransitioning = false; }
}

async function closeOverlayWithTransition() {
  const overlay = window.__SPA_Overlay;
  if (!overlay?.isOpen() || isTransitioning || isPulling) return;

  isTransitioning = true;
  let fromSurf, toSurf;
  try { [fromSurf, toSurf] = await Promise.all([heroSurface.buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'), heroSurface.buildHeroSurface(currentSectionIdx, currentItemIdx, 'to')]); } catch (_) {}

  try {
    await runner.runHeroTransition(fromSurf, toSurf, {
      onBeforeReveal: async () => { overlay.close({ restore: false }); heroRenderer.renderHeroDOM(currentSectionIdx, currentItemIdx); }
    });
  } finally { isTransitioning = false; heroSurface.startTracking(currentSectionIdx, currentItemIdx); }
}

// ─── Game mode ────────────────────────────────────────────────────────────────

async function enterCurrentGameWithTransition() {
  if (isTransitioning || isPulling) return;
  const gameNav = window.__SPA_GameNav;
  if (!gameNav) return;
  const probe = gameNav.buildHeroProbe?.(currentSectionIdx, currentItemIdx);
  if (!probe) return;

  isTransitioning = true;
  heroSurface.stopTracking();
  document.body.appendChild(probe.element);

  let fromSurf, toSurf;
  try { [fromSurf, toSurf] = await Promise.all([heroSurface.buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'), rasterizeHero({ type: 'textElement', element: probe.element })]); } catch (_) { probe.cleanup?.(); isTransitioning = false; return; }
  probe.cleanup?.();

  try {
    await runner.runHeroTransition(fromSurf, toSurf, {
      onBeforeReveal: async () => {
        window.__SPA_SetGameMode(true);
        window.__SPA_Views?.['games']?.mount?.('asymptote', heroContainer);
      }
    });
  } finally { isTransitioning = false; }
}

async function exitGameToCurrentItem() {
  if (isTransitioning || isPulling) return;
  isTransitioning = true;
  let fromSurf, toSurf;
  try { [fromSurf, toSurf] = await Promise.all([heroSurface.buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'), heroSurface.buildHeroSurface(currentSectionIdx, currentItemIdx, 'to')]); } catch (_) {}
  try {
    await runner.runHeroTransition(fromSurf, toSurf, {
      onBeforeReveal: async () => { window.__SPA_SetGameMode(false); heroRenderer.renderHeroDOM(currentSectionIdx, currentItemIdx); }
    });
  } finally { isTransitioning = false; heroSurface.startTracking(currentSectionIdx, currentItemIdx); }
}

async function gameNavigate(direction) {
  const gameNav = window.__SPA_GameNav;
  if (!gameNav || isTransitioning || isPulling) return;
  const from = gameNav.getFromTarget?.();
  const to   = gameNav.getToTarget?.(direction);
  if (!from || !to) return;

  const fromProbe = gameNav.buildHeroProbe?.(from.sectionIdx, from.itemIdx);
  const toProbe   = gameNav.buildHeroProbe?.(to.sectionIdx,   to.itemIdx);
  if (!fromProbe || !toProbe) { fromProbe?.cleanup?.(); toProbe?.cleanup?.(); return; }

  isTransitioning = true;
  document.body.appendChild(fromProbe.element);
  document.body.appendChild(toProbe.element);
  let fromSurf, toSurf;
  try {
    [fromSurf, toSurf] = await Promise.all([rasterizeHero({ type: 'textElement', element: fromProbe.element }), rasterizeHero({ type: 'textElement', element: toProbe.element })]);
  } catch (_) { fromProbe.cleanup?.(); toProbe.cleanup?.(); isTransitioning = false; return; }
  fromProbe.cleanup?.(); toProbe.cleanup?.();

  try {
    await runner.runHeroTransition(fromSurf, toSurf, {
      ...desktopNav.getNavOptions(),
      onBeforeReveal: async () => {
        gameNav.commitTo?.(to.sectionIdx, to.itemIdx);
        window.__SPA_Views?.['games']?.mount?.('asymptote', heroContainer);
      }
    });
  } finally { isTransitioning = false; }
}

// ─── Slingshot callbacks ──────────────────────────────────────────────────────

function onSlingshotTap() {
  if (window.__SPA_Overlay?.shouldSuppressTap?.()) return;
  if (window.__SPA_Overlay?.isOpen()) { void closeOverlayWithTransition(); return; }
  if (isAsymptoteGameActive) { window.__SPA_GameNav?.onTap?.(); return; }
  const action = getClickAction(currentSectionIdx, currentItemIdx);
  if (action) handleHeroAction(action);
}

function onSlingshotLock({ direction }) {
  if (isTransitioning && !isPulling) {
    const t = getTargetForDirection(direction, currentSectionIdx, currentItemIdx, homeSectionLocked);
    if (t) queuedTarget = { sectionIdx: t.sectionIdx, itemIdx: t.itemIdx };
    return false;
  }
  if (isPulling) return false;

  let targetSi, targetIi;
  if (isAsymptoteGameActive && window.__SPA_GameNav) {
    const t = window.__SPA_GameNav.getToTarget?.(direction);
    if (!t) return false;
    targetSi = t.sectionIdx; targetIi = t.itemIdx;
  } else {
    const t = getTargetForDirection(direction, currentSectionIdx, currentItemIdx, homeSectionLocked);
    if (!t) return false;
    targetSi = t.sectionIdx; targetIi = t.itemIdx;
  }

  pullTargetSectionIdx = targetSi;
  pullTargetItemIdx    = targetIi;
  isPulling            = true;
  isTransitioning      = true;
  slingshotPreview.reset();
  pullPreviewParticles = null;

  // Build surfaces in parallel
  const fp = heroSurface.buildHeroSurface(currentSectionIdx, currentItemIdx, 'from');
  const tp = heroSurface.buildHeroSurface(targetSi, targetIi, 'to');
  pullFromSurfacePromise = fp;
  pullToSurfacePromise   = tp;
  fp.then(s => { if (pullFromSurfacePromise === fp) pullFromSurface = s; }).catch(() => {});
  tp.then(s => { if (pullToSurfacePromise   === tp) pullToSurface   = s; }).catch(() => {});

  heroSurface.stopTracking();
  runner.alignTransitionCanvas({ width: 320, height: 320 }, { width: 320, height: 320 });
  transitionCanvas.style.display    = 'block';
  transitionCanvas.style.opacity    = '1';
  transitionCanvas.style.transition = '';
  const heroEl = heroContainer.firstElementChild;
  if (heroEl) { heroEl.style.visibility = 'hidden'; heroEl.style.opacity = '0'; heroEl.style.transition = ''; }

  return true;
}

function onSlingshotPull({ pullVector, pullNormalized }) {
  if (pullFromSurface) runner.alignTransitionCanvas(pullFromSurface, pullFromSurface);
  const result = slingshotPreview.renderPullPreview(pullVector, pullNormalized, pullFromSurface);
  if (result) {
    pullPreviewParticles = result.particles;
    pullPreviewCanvasW   = result.canvasW;
    pullPreviewCanvasH   = result.canvasH;
  } else {
    pullPreviewParticles = null;
  }
}

async function onSlingshotRelease({ pullNormalized }) {
  if (pullNormalized < SLINGSHOT_MIN_RELEASE) { cancelSlingshot(); return; }

  const targetSi = pullTargetSectionIdx, targetIi = pullTargetItemIdx;

  let fromSurf, toSurf;
  try {
    [fromSurf, toSurf] = await Promise.all([
      pullFromSurfacePromise || heroSurface.buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'),
      pullToSurfacePromise   || heroSurface.buildHeroSurface(targetSi, targetIi, 'to')
    ]);
  } catch (_) { cancelSlingshot(); return; }

  if (!fromSurf || !toSurf) { cancelSlingshot(); return; }

  runner.alignTransitionCanvas(fromSurf, toSurf);
  const cw = transitionCanvas.width, ch = transitionCanvas.height;

  // Remap pull particles to new canvas size
  let remapped = null;
  if (pullPreviewParticles?.length) {
    const shiftX = (cw - pullPreviewCanvasW) / 2, shiftY = (ch - pullPreviewCanvasH) / 2;
    remapped = pullPreviewParticles.map(p => ({ x: p.x + shiftX, y: p.y + shiftY, color: p.color }));
  }

  const fromSi = currentSectionIdx, fromIi = currentItemIdx;
  try {
    if (remapped) {
      await new Promise(resolve => {
        transitionFromPull(remapped, toSurf, transitionCtx, {}, resolve);
      });
    } else {
      await new Promise(resolve => {
        transition(fromSurf.canvas, toSurf.canvas, { ctx: transitionCtx, fromRegion: fromSurf, toRegion: toSurf, timingProfile: 'default' }, resolve);
      });
    }

    heroRenderer.renderHeroDOM(targetSi, targetIi);
    navRenderer.updateSectionNav(targetSi, homeSectionLocked);
    navRenderer.updateItemDots(targetSi, targetIi);

    const revealHero = heroContainer.firstElementChild;
    if (revealHero) { revealHero.style.visibility = 'visible'; revealHero.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-out`; }
    transitionCanvas.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-in`;
    await waitRaf();
    if (revealHero) revealHero.style.opacity = '1';
    transitionCanvas.style.opacity = '0';
    await waitMs(REVEAL_HANDOFF_FADE_MS);
    transitionCanvas.style.display = 'none'; transitionCanvas.style.opacity = '1'; transitionCanvas.style.transition = '';
    if (revealHero) revealHero.style.transition = '';

    currentSectionIdx = targetSi; currentItemIdx = targetIi;
    if (isAsymptoteGameActive && window.__SPA_GameNav) window.__SPA_GameNav.commitTo?.(targetSi, targetIi);

    const inSection = getSection(targetSi), inItem = getItem(targetSi, targetIi);
    if (inSection && inItem) try { window.__SPA_Views?.[inSection.id]?.onActivate?.(inItem.id); } catch (_) {}

  } catch (_) {}

  cleanupPull();
  heroSurface.startTracking(currentSectionIdx, currentItemIdx);
  if (queuedTarget) { const q = queuedTarget; queuedTarget = null; void goTo(q.sectionIdx, q.itemIdx, q.navOpts || {}); }
}

function onSlingshotCancel() { cancelSlingshot(); }

function cancelSlingshot() {
  transitionCanvas.style.display = 'none'; transitionCanvas.style.opacity = '1'; transitionCanvas.style.transition = '';
  const heroEl = heroContainer.firstElementChild;
  if (heroEl) { heroEl.style.visibility = 'visible'; heroEl.style.opacity = '1'; heroEl.style.transition = ''; }
  cleanupPull();
  heroSurface.startTracking(currentSectionIdx, currentItemIdx);
  const section = getSection(currentSectionIdx), item = getItem(currentSectionIdx, currentItemIdx);
  if (section && item) try { window.__SPA_Views?.[section.id]?.onActivate?.(item.id); } catch (_) {}
}

function cleanupPull() {
  isPulling = false; isTransitioning = false; activeTarget = null;
  pullTargetSectionIdx = null; pullTargetItemIdx = null;
  pullFromSurface = null; pullToSurface = null;
  pullFromSurfacePromise = null; pullToSurfacePromise = null;
  pullPreviewParticles = null;
  pullPreviewCanvasW = 0; pullPreviewCanvasH = 0;
  slingshotPreview.reset();
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const direction = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 'next' : 'prev';
  if (isAsymptoteGameActive && window.__SPA_GameNav) { void gameNavigate(direction); return; }
  const t = getTargetForDirection(direction, currentSectionIdx, currentItemIdx, homeSectionLocked);
  if (t) goTo(t.sectionIdx, t.itemIdx, desktopNav.getNavOptions());
});

// ─── Item nav buttons ─────────────────────────────────────────────────────────

navRenderer.setupItemNav(
  document.getElementById('spa-prev-btn'),
  document.getElementById('spa-next-btn'),
  () => {
    if (isAsymptoteGameActive && window.__SPA_GameNav) { void gameNavigate('prev'); return; }
    const t = getTargetForDirection('prev', currentSectionIdx, currentItemIdx, homeSectionLocked);
    if (t) goTo(t.sectionIdx, t.itemIdx, desktopNav.getNavOptions());
  },
  () => {
    if (isAsymptoteGameActive && window.__SPA_GameNav) { void gameNavigate('next'); return; }
    const t = getTargetForDirection('next', currentSectionIdx, currentItemIdx, homeSectionLocked);
    if (t) goTo(t.sectionIdx, t.itemIdx, desktopNav.getNavOptions());
  }
);

// ─── Boot ─────────────────────────────────────────────────────────────────────

render();

const _initSection = getSection(0), _initItem = getItem(0, 0);
if (_initSection && _initItem) try { window.__SPA_Views?.[_initSection.id]?.onActivate?.(_initItem.id); } catch (_) {}

heroSurface.startTracking(0, 0);

initSlingshot(heroContainer, {
  onTap:     onSlingshotTap,
  onLock:    onSlingshotLock,
  onPull:    onSlingshotPull,
  onRelease: onSlingshotRelease,
  onCancel:  onSlingshotCancel
});
