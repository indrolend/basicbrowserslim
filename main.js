// ─── Module imports (hoisted by JS engine) ───────────────────────────────────
import { rasterizeHero }                  from './js/spa/rasterizeHero.js';
import { transition, transitionFromPull } from './js/spa/particleTransitionEngine.js';
import { initSlingshot }                  from './js/spa/slingshotGesture.js';

// ─── Sections data ────────────────────────────────────────────────────────────

const SPA_SECTIONS = [
  {
    id: 'home', label: 'Home',
    items: [
      { id: 'orb', label: 'Indrolend', hero: { kind: 'text', text: 'INDROLEND' }, swipe: true }
    ]
  },
  {
    id: 'social', label: 'Social',
    items: [
      { id: 'tiktok',    label: 'TikTok',    hero: { kind: 'image', src: 'gifs/Tiktoklogospin.gif' } },
      { id: 'instagram', label: 'Instagram', hero: { kind: 'image', src: 'gifs/Instagramlogospin.gif' } },
      { id: 'youtube',   label: 'YouTube',   hero: { kind: 'image', src: 'gifs/Youtubelogospin.gif' } }
    ]
  },
  {
    id: 'music', label: 'Music',
    items: [
      { id: 'spotify',    label: 'Spotify',     hero: { kind: 'image', src: 'gifs/Spotifylogospin.gif' } },
      { id: 'appleMusic', label: 'Apple Music', hero: { kind: 'image', src: 'gifs/Applemusiclogospin.gif' } },
      { id: 'bandcamp',   label: 'Bandcamp',    hero: { kind: 'image', src: 'gifs/bandcamplogospin.gif' } },
      { id: 'soundcloud', label: 'SoundCloud',  hero: { kind: 'image', src: 'gifs/soundcloudlogospin.gif' } }
    ]
  },
  {
    id: 'games', label: 'Games',
    items: [
      { id: 'asymptote', label: 'Asymptote Engine', hero: { kind: 'text', text: 'Asymptote Engine' } }
    ]
  }
];

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_PADDING_PX         = 72;
const SLINGSHOT_MIN_RELEASE    = 0.15;
const REVEAL_HANDOFF_FADE_MS   = 70;
const DESKTOP_CHAIN_WINDOW_MS  = 260;
const STRETCH_MAX              = 55;
const TRAIL_BIAS               = 0.55;
const SLINGSHOT_PARTICLE_SIZE  = 4;

// ─── DOM ──────────────────────────────────────────────────────────────────────

const heroContainer    = document.getElementById('spa-hero-container');
const transitionCanvas = document.getElementById('transition-canvas');
const transitionCtx    = transitionCanvas.getContext('2d');
const dotsContainer    = document.getElementById('spa-dots');
const itemNavEl        = document.getElementById('spa-item-nav');

// ─── State ────────────────────────────────────────────────────────────────────

let currentSectionIdx = 0, currentItemIdx = 0;
let isTransitioning = false, isPulling = false;
let queuedTarget = null, activeTarget = null;
let homeSectionLocked = false;
let isAsymptoteGameActive = false;
let lastDesktopNavInputAt = 0;

// Hero surface tracking (RAF loop for textElement heroes)
let currentHeroSurface = null;
let currentHeroSurfaceKey = null;
let currentHeroSurfaceFrameId = null;
let currentHeroSurfaceTrackingKey = null;

// Slingshot pull state
let pullTargetSectionIdx = null, pullTargetItemIdx = null;
let pullFromSurface = null, pullToSurface = null;
let pullFromSurfacePromise = null, pullToSurfacePromise = null;
let pullPreviewParticlesBase = null, pullPreviewParticles = null;
let pullPreviewCanvasW = 0, pullPreviewCanvasH = 0;

// ─── Window API (written here, read by external modules) ──────────────────────

window.__SPA_SetGameMode = (active) => { isAsymptoteGameActive = !!active; };

window.__SPA_GoHome = () => goTo(0, 0);

window.__SPA_ExitGameToCurrentItem = () => void exitGameToCurrentItem();

window.__SPA_EnterCurrentGame = () => void enterCurrentGameWithTransition();

window.__SPA_RestoreCurrentItemHero = () => {
  renderHeroDOM(currentSectionIdx, currentItemIdx);
  startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);
};

window.__SPA_CloseCurrentOverlayWithTransition = () => void closeOverlayWithTransition();

window.__SPA_CancelSlingshot = () => cancelSlingshot();

// ─── Utility helpers ──────────────────────────────────────────────────────────

function addActivationHandler(element, handler) {
  let touchFired = false;
  element.addEventListener('touchend', (e) => {
    touchFired = true;
    e.preventDefault();
    handler(e);
    setTimeout(() => { touchFired = false; }, 600);
  });
  element.addEventListener('click', (e) => { if (!touchFired) handler(e); });
}

function waitRaf()    { return new Promise(resolve => requestAnimationFrame(resolve)); }
function waitMs(ms)   { return new Promise(resolve => setTimeout(resolve, ms)); }

function getSafeExternalUrl(href) {
  try {
    const url = new URL(href, window.location.origin);
    if (url.protocol === 'https:') return url.href;
  } catch (_) {}
  return null;
}

// ─── Data accessors ───────────────────────────────────────────────────────────

function getSection(si)        { return SPA_SECTIONS[si] ?? null; }
function getItem(si, ii)       { return SPA_SECTIONS[si]?.items[ii] ?? null; }
function getHeroSpec(si, ii)   { return getItem(si, ii)?.hero ?? { kind: 'text', text: '' }; }
function getHeroSurfaceKey(si, ii) { return `${si}:${ii}`; }

function isGifHero(si, ii) {
  const hero = getHeroSpec(si, ii);
  return hero.kind === 'image' && /\.gif(?:[?#]|$)/i.test(hero.src || '');
}

function getClickAction(si, ii) {
  const section = getSection(si);
  const item    = getItem(si, ii);
  if (!section || !item) return null;
  return window.__INDROLEND_ROUTES__?.items?.[`${section.id}/${item.id}`]?.clickAction ?? null;
}

// ─── Navigation helpers ───────────────────────────────────────────────────────

function getAvailableSections() {
  return homeSectionLocked ? SPA_SECTIONS.filter((_, i) => i !== 0) : SPA_SECTIONS;
}

function getNextTarget(si, ii) {
  const section = getSection(si);
  if (!section) return null;
  if (ii + 1 < section.items.length) return { sectionIdx: si, itemIdx: ii + 1 };
  const avail = getAvailableSections();
  const pos   = avail.findIndex(s => s === section);
  const next  = avail[(pos + 1) % avail.length];
  return { sectionIdx: SPA_SECTIONS.indexOf(next), itemIdx: 0 };
}

function getPrevTarget(si, ii) {
  const section = getSection(si);
  if (!section) return null;
  if (ii - 1 >= 0) return { sectionIdx: si, itemIdx: ii - 1 };
  const avail = getAvailableSections();
  const pos   = avail.findIndex(s => s === section);
  const prev  = avail[(pos - 1 + avail.length) % avail.length];
  const prevSi = SPA_SECTIONS.indexOf(prev);
  return { sectionIdx: prevSi, itemIdx: SPA_SECTIONS[prevSi].items.length - 1 };
}

function getDesktopNavOptions() {
  const now     = performance.now();
  const chained = (now - lastDesktopNavInputAt) < DESKTOP_CHAIN_WINDOW_MS;
  lastDesktopNavInputAt = now;
  return { timingProfile: chained ? 'chained' : 'default' };
}

// ─── Hero DOM rendering ───────────────────────────────────────────────────────

function renderHeroDOM(si, ii) {
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
    wrapper.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleHeroAction(clickAction); }
    });
    addActivationHandler(wrapper, () => handleHeroAction(clickAction));
  }

  if (heroSpec.kind === 'image') {
    const img = document.createElement('img');
    img.className = 'spa-hero-image';
    img.src       = heroSpec.src;
    img.width     = 320;
    img.height    = 320;
    img.style.objectFit = 'contain';
    img.setAttribute('draggable', 'false');
    wrapper.appendChild(img);
  } else {
    wrapper.classList.add('spa-hero--text');
    const textEl = document.createElement('div');
    textEl.className    = 'spa-hero-text';
    textEl.textContent  = heroSpec.text || item.label;
    wrapper.appendChild(textEl);
  }

  heroContainer.appendChild(wrapper);
}

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

// ─── Nav DOM rendering ────────────────────────────────────────────────────────

function updateSectionNav(si) {
  let nav = document.getElementById('spa-section-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'spa-section-nav';
    nav.setAttribute('aria-label', 'Sections');
    document.body.insertBefore(nav, document.body.firstChild);
  }
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
    if (idx === si) { btn.style.fontWeight = 'bold'; btn.style.background = '#333'; btn.setAttribute('aria-current', 'page'); }
    addActivationHandler(btn, () => goTo(idx, 0));
    nav.appendChild(btn);
  }
}

function updateItemDots(si, ii) {
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
    addActivationHandler(btn, () => goTo(si, idx));
    dotsContainer.appendChild(btn);
  });
}

function render() {
  updateSectionNav(currentSectionIdx);
  updateItemDots(currentSectionIdx, currentItemIdx);
  renderHeroDOM(currentSectionIdx, currentItemIdx);
}

function setupItemNav() {
  const prevBtn = document.getElementById('spa-prev-btn');
  const nextBtn = document.getElementById('spa-next-btn');
  if (prevBtn) addActivationHandler(prevBtn, () => {
    if (isAsymptoteGameActive && window.__SPA_GameNav) { void gameNavigate('prev'); return; }
    const t = getPrevTarget(currentSectionIdx, currentItemIdx);
    if (t) goTo(t.sectionIdx, t.itemIdx, getDesktopNavOptions());
  });
  if (nextBtn) addActivationHandler(nextBtn, () => {
    if (isAsymptoteGameActive && window.__SPA_GameNav) { void gameNavigate('next'); return; }
    const t = getNextTarget(currentSectionIdx, currentItemIdx);
    if (t) goTo(t.sectionIdx, t.itemIdx, getDesktopNavOptions());
  });
}

// ─── Transition canvas alignment ──────────────────────────────────────────────

function alignTransitionCanvas(fromSurface, toSurface) {
  const stageW = Math.max(fromSurface?.width  ?? 0, toSurface?.width  ?? 0) + STAGE_PADDING_PX * 2;
  const stageH = Math.max(fromSurface?.height ?? 0, toSurface?.height ?? 0) + STAGE_PADDING_PX * 2;
  transitionCanvas.width  = Math.max(stageW, 64);
  transitionCanvas.height = Math.max(stageH, 64);

  const rootRect = document.getElementById('spa-root').getBoundingClientRect();
  const heroRect = heroContainer.getBoundingClientRect();
  const cx = heroRect.left + heroRect.width  / 2 - rootRect.left;
  const cy = heroRect.top  + heroRect.height / 2 - rootRect.top;
  transitionCanvas.style.left = `${cx}px`;
  transitionCanvas.style.top  = `${cy}px`;
}

// ─── Hero surface capture ─────────────────────────────────────────────────────

function stopCurrentHeroSurfaceTracking() {
  if (currentHeroSurfaceFrameId) { cancelAnimationFrame(currentHeroSurfaceFrameId); currentHeroSurfaceFrameId = null; }
  currentHeroSurfaceTrackingKey = null;
}

function startCurrentHeroSurfaceTracking(si, ii) {
  stopCurrentHeroSurfaceTracking();
  const key = getHeroSurfaceKey(si, ii);
  currentHeroSurfaceTrackingKey = key;

  // GIF and procedural heroes: no surface cache
  if (isGifHero(si, ii) || window.__SPA_Views?.[getSection(si)?.id]?.buildHeroProbe) {
    currentHeroSurface = null; currentHeroSurfaceKey = null; return;
  }

  function refresh() {
    buildHeroSurface(si, ii, 'from').then(s => {
      if (currentHeroSurfaceTrackingKey !== key) return;
      currentHeroSurface    = s;
      currentHeroSurfaceKey = key;
    }).catch(() => {});
  }

  function loop() {
    if (currentHeroSurfaceTrackingKey !== key) return;
    if (!isTransitioning) refresh();
    currentHeroSurfaceFrameId = requestAnimationFrame(loop);
  }
  currentHeroSurfaceFrameId = requestAnimationFrame(loop);
}

function buildHeroRenderInput(si, ii, phase) {
  const section = getSection(si);
  const item    = getItem(si, ii);
  if (!section || !item) return null;

  const heroSpec   = getHeroSpec(si, ii);
  const viewModule = window.__SPA_Views?.[section.id];

  if (phase === 'from') {
    // Live hero element in DOM
    const liveImg = heroContainer.querySelector('.spa-hero-image');
    if (liveImg) return { type: 'element', element: liveImg };

    const liveHero = heroContainer.querySelector('.spa-hero');
    if (liveHero) return { type: 'textElement', element: liveHero };

    // Overlay inline element
    const overlayRoot = document.getElementById('spa-overlay-root');
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

  return { type: 'text', text: heroSpec.text || item.label };
}

async function buildHeroSurface(si, ii, phase) {
  const key     = getHeroSurfaceKey(si, ii);
  const cached  = phase === 'from' && currentHeroSurface && currentHeroSurfaceKey === key && !isGifHero(si, ii);
  if (cached) return currentHeroSurface;

  const input = buildHeroRenderInput(si, ii, phase);
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

// ─── Transition runner ────────────────────────────────────────────────────────

async function runHeroTransition(fromSurface, toSurface, opts = {}) {
  if (!fromSurface || !toSurface) {
    if (opts.onBeforeReveal) await opts.onBeforeReveal();
    return;
  }

  alignTransitionCanvas(fromSurface, toSurface);

  // Hide live hero, show canvas
  const heroEl = heroContainer.firstElementChild;
  if (heroEl) { heroEl.style.visibility = 'hidden'; heroEl.style.opacity = '0'; heroEl.style.transition = ''; }
  transitionCanvas.style.display    = 'block';
  transitionCanvas.style.opacity    = '1';
  transitionCanvas.style.transition = '';

  try {
    await new Promise(resolve => {
      transition(fromSurface.canvas, toSurface.canvas, {
        ctx: transitionCtx,
        fromRegion: fromSurface,
        toRegion:   toSurface,
        timingProfile: opts.timingProfile || 'default'
      }, resolve);
    });
  } finally {
    if (opts.onBeforeReveal) await opts.onBeforeReveal();

    const revealHero = heroContainer.firstElementChild;
    if (revealHero) { revealHero.style.visibility = 'visible'; revealHero.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-out`; }
    transitionCanvas.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-in`;

    await waitRaf();
    if (revealHero) revealHero.style.opacity = '1';
    transitionCanvas.style.opacity = '0';
    await waitMs(REVEAL_HANDOFF_FADE_MS);

    transitionCanvas.style.display    = 'none';
    transitionCanvas.style.opacity    = '1';
    transitionCanvas.style.transition = '';
    if (revealHero) revealHero.style.transition = '';
  }
}

// ─── goTo ─────────────────────────────────────────────────────────────────────

async function goTo(nextSi, nextIi, navOpts = {}) {
  if (homeSectionLocked && nextSi === 0 && currentSectionIdx !== 0) return;
  if (nextSi === currentSectionIdx && nextIi === currentItemIdx && !isPulling) return;
  if (isTransitioning || isPulling) { queuedTarget = { sectionIdx: nextSi, itemIdx: nextIi, navOpts }; return; }

  const fromSi = currentSectionIdx, fromIi = currentItemIdx;
  isTransitioning = true;
  activeTarget    = { sectionIdx: nextSi, itemIdx: nextIi };
  stopCurrentHeroSurfaceTracking();

  // Deactivate outgoing
  const outSection = getSection(fromSi), outItem = getItem(fromSi, fromIi);
  if (outSection && outItem) try { window.__SPA_Views?.[outSection.id]?.onDeactivate?.(outItem.id); } catch (_) {}

  let fromSurface, toSurface;
  try { [fromSurface, toSurface] = await Promise.all([buildHeroSurface(fromSi, fromIi, 'from'), buildHeroSurface(nextSi, nextIi, 'to')]); } catch (_) {}

  let didRenderDuringReveal = false;
  try {
    await runHeroTransition(fromSurface, toSurface, {
      ...navOpts,
      onBeforeReveal: async () => {
        closeOverlayForNav();
        if (nextSi !== 0 && !homeSectionLocked) homeSectionLocked = true;
        renderHeroDOM(nextSi, nextIi);
        updateSectionNav(nextSi);
        updateItemDots(nextSi, nextIi);
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
    startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);

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
  stopCurrentHeroSurfaceTracking();

  let fromSurface, toSurface;
  try {
    document.body.appendChild(probe.element);
    [fromSurface, toSurface] = await Promise.all([
      buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'),
      rasterizeHero({ type: 'textElement', element: probe.element })
    ]);
  } catch (_) {
    probe.cleanup?.(); isTransitioning = false;
    startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);
    overlay.open(overlayId); return;
  }

  try {
    await runHeroTransition(fromSurface, toSurface, {
      onBeforeReveal: async () => { probe.cleanup?.(); overlay.openInline(overlayId, {}, heroContainer); }
    });
  } finally { isTransitioning = false; }
}

async function closeOverlayWithTransition() {
  const overlay = window.__SPA_Overlay;
  if (!overlay?.isOpen() || isTransitioning || isPulling) return;

  isTransitioning = true;
  let fromSurface, toSurface;
  try { [fromSurface, toSurface] = await Promise.all([buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'), buildHeroSurface(currentSectionIdx, currentItemIdx, 'to')]); } catch (_) {}

  try {
    await runHeroTransition(fromSurface, toSurface, {
      onBeforeReveal: async () => { overlay.close({ restore: false }); renderHeroDOM(currentSectionIdx, currentItemIdx); }
    });
  } finally { isTransitioning = false; startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx); }
}

// ─── Game mode ────────────────────────────────────────────────────────────────

async function enterCurrentGameWithTransition() {
  if (isTransitioning || isPulling) return;
  const gameNav = window.__SPA_GameNav;
  if (!gameNav) return;
  const probe = gameNav.buildHeroProbe?.(currentSectionIdx, currentItemIdx);
  if (!probe) return;

  isTransitioning = true;
  stopCurrentHeroSurfaceTracking();
  document.body.appendChild(probe.element);

  let fromSurface, toSurface;
  try { [fromSurface, toSurface] = await Promise.all([buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'), rasterizeHero({ type: 'textElement', element: probe.element })]); } catch (_) { probe.cleanup?.(); isTransitioning = false; return; }
  probe.cleanup?.();

  try {
    await runHeroTransition(fromSurface, toSurface, {
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
  let fromSurface, toSurface;
  try { [fromSurface, toSurface] = await Promise.all([buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'), buildHeroSurface(currentSectionIdx, currentItemIdx, 'to')]); } catch (_) {}
  try {
    await runHeroTransition(fromSurface, toSurface, {
      onBeforeReveal: async () => { window.__SPA_SetGameMode(false); renderHeroDOM(currentSectionIdx, currentItemIdx); }
    });
  } finally { isTransitioning = false; startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx); }
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
  let fromSurface, toSurface;
  try {
    [fromSurface, toSurface] = await Promise.all([rasterizeHero({ type: 'textElement', element: fromProbe.element }), rasterizeHero({ type: 'textElement', element: toProbe.element })]);
  } catch (_) { fromProbe.cleanup?.(); toProbe.cleanup?.(); isTransitioning = false; return; }
  fromProbe.cleanup?.(); toProbe.cleanup?.();

  try {
    await runHeroTransition(fromSurface, toSurface, {
      ...getDesktopNavOptions(),
      onBeforeReveal: async () => {
        gameNav.commitTo?.(to.sectionIdx, to.itemIdx);
        window.__SPA_Views?.['games']?.mount?.('asymptote', heroContainer);
      }
    });
  } finally { isTransitioning = false; }
}

// ─── Slingshot pull preview ───────────────────────────────────────────────────

let _pullOffscreen = null;

function sampleParticles(surface, cw, ch) {
  if (!_pullOffscreen) _pullOffscreen = document.createElement('canvas');
  const c = _pullOffscreen;
  c.width = cw; c.height = ch;
  const cctx = c.getContext('2d');
  cctx.clearRect(0, 0, cw, ch);
  const dx = (cw - surface.width) / 2, dy = (ch - surface.height) / 2;
  cctx.drawImage(surface.canvas, 0, 0, surface.width, surface.height, dx, dy, surface.width, surface.height);
  const data = cctx.getImageData(0, 0, cw, ch).data;
  const cx0 = cw / 2, cy0 = ch / 2;
  const result = [];
  for (let y = 0; y < ch; y += SLINGSHOT_PARTICLE_SIZE) {
    for (let x = 0; x < cw; x += SLINGSHOT_PARTICLE_SIZE) {
      const idx = (y * cw + x) * 4;
      if (data[idx + 3] > 32) {
        result.push({ x, y, cx: x - cx0, cy: y - cy0,
          color: `rgba(${data[idx]},${data[idx+1]},${data[idx+2]},${(data[idx+3]/255).toFixed(2)})`,
          frayX: Math.random() * 2 - 1, frayY: Math.random() * 2 - 1 });
      }
    }
  }
  return result;
}

function renderPullPreview(pullVector, pullNormalized) {
  if (!pullFromSurface) return;
  const cw = transitionCanvas.width, ch = transitionCanvas.height;
  transitionCtx.clearRect(0, 0, cw, ch);

  const len  = Math.sqrt(pullVector.x * pullVector.x + pullVector.y * pullVector.y);
  const pnx  = len > 0 ? pullVector.x / len : 0;
  const pny  = len > 0 ? pullVector.y / len : 0;
  const maxR = Math.min(cw, ch) * 0.5;

  if (pullNormalized < 0.25) {
    // Phase A: solid hero
    const dx = (cw - pullFromSurface.width) / 2, dy = (ch - pullFromSurface.height) / 2;
    transitionCtx.drawImage(pullFromSurface.canvas, 0, 0, pullFromSurface.width, pullFromSurface.height, dx, dy, pullFromSurface.width, pullFromSurface.height);
    pullPreviewParticles = null;
    return;
  }

  // Phase B (0.25→0.65): fray particles
  // Phase C (0.65→1.0): full preview
  if (!pullPreviewParticlesBase) {
    pullPreviewParticlesBase = sampleParticles(pullFromSurface, cw, ch);
  }

  const phaseB = Math.min(1, (pullNormalized - 0.25) / 0.4);

  if (phaseB < 1) {
    transitionCtx.globalAlpha = 1 - phaseB;
    const dx = (cw - pullFromSurface.width) / 2, dy = (ch - pullFromSurface.height) / 2;
    transitionCtx.drawImage(pullFromSurface.canvas, 0, 0, pullFromSurface.width, pullFromSurface.height, dx, dy, pullFromSurface.width, pullFromSurface.height);
    transitionCtx.globalAlpha = 1;
  }

  const particles    = pullPreviewParticlesBase;
  const drawnParticles = [];
  transitionCtx.globalAlpha = Math.min(1, phaseB * 2);

  for (const p of particles) {
    const proj      = (p.cx * pnx + p.cy * pny) / (maxR * 0.5);
    const asymScale = proj >= 0 ? 0.4 : 1.2;
    const stretch   = proj * pullNormalized * STRETCH_MAX * asymScale;
    const trailX    = -pnx * TRAIL_BIAS + p.frayX * (1 - TRAIL_BIAS);
    const trailY    = -pny * TRAIL_BIAS + p.frayY * (1 - TRAIL_BIAS);
    const nx = p.x + trailX * stretch;
    const ny = p.y + trailY * stretch;
    drawnParticles.push({ x: nx, y: ny, color: p.color });
    transitionCtx.fillStyle = p.color;
    transitionCtx.beginPath();
    transitionCtx.arc(nx, ny, SLINGSHOT_PARTICLE_SIZE / 2, 0, Math.PI * 2);
    transitionCtx.fill();
  }

  transitionCtx.globalAlpha = 1;
  pullPreviewParticles  = drawnParticles;
  pullPreviewCanvasW    = cw;
  pullPreviewCanvasH    = ch;
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
    const t = direction === 'next' ? getNextTarget(currentSectionIdx, currentItemIdx) : getPrevTarget(currentSectionIdx, currentItemIdx);
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
    const t = direction === 'next' ? getNextTarget(currentSectionIdx, currentItemIdx) : getPrevTarget(currentSectionIdx, currentItemIdx);
    if (!t) return false;
    targetSi = t.sectionIdx; targetIi = t.itemIdx;
  }

  pullTargetSectionIdx = targetSi;
  pullTargetItemIdx    = targetIi;
  isPulling            = true;
  isTransitioning      = true;
  pullPreviewParticlesBase = null;
  pullPreviewParticles     = null;

  // Build surfaces in parallel
  const fp = buildHeroSurface(currentSectionIdx, currentItemIdx, 'from');
  const tp = buildHeroSurface(targetSi, targetIi, 'to');
  pullFromSurfacePromise = fp;
  pullToSurfacePromise   = tp;
  fp.then(s => { if (pullFromSurfacePromise === fp) pullFromSurface = s; }).catch(() => {});
  tp.then(s => { if (pullToSurfacePromise   === tp) pullToSurface   = s; }).catch(() => {});

  stopCurrentHeroSurfaceTracking();
  alignTransitionCanvas({ width: 320, height: 320 }, { width: 320, height: 320 });
  transitionCanvas.style.display    = 'block';
  transitionCanvas.style.opacity    = '1';
  transitionCanvas.style.transition = '';
  const heroEl = heroContainer.firstElementChild;
  if (heroEl) { heroEl.style.visibility = 'hidden'; heroEl.style.opacity = '0'; heroEl.style.transition = ''; }

  return true;
}

function onSlingshotPull({ pullVector, pullNormalized }) {
  if (pullFromSurface) alignTransitionCanvas(pullFromSurface, pullFromSurface);
  renderPullPreview(pullVector, pullNormalized);
}

async function onSlingshotRelease({ pullNormalized }) {
  if (pullNormalized < SLINGSHOT_MIN_RELEASE) { cancelSlingshot(); return; }

  const targetSi = pullTargetSectionIdx, targetIi = pullTargetItemIdx;

  let fromSurface, toSurface;
  try {
    [fromSurface, toSurface] = await Promise.all([
      pullFromSurfacePromise || buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'),
      pullToSurfacePromise   || buildHeroSurface(targetSi, targetIi, 'to')
    ]);
  } catch (_) { cancelSlingshot(); return; }

  if (!fromSurface || !toSurface) { cancelSlingshot(); return; }

  alignTransitionCanvas(fromSurface, toSurface);
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
        transitionFromPull(remapped, toSurface, transitionCtx, {}, resolve);
      });
    } else {
      await new Promise(resolve => {
        transition(fromSurface.canvas, toSurface.canvas, { ctx: transitionCtx, fromRegion: fromSurface, toRegion: toSurface, timingProfile: 'default' }, resolve);
      });
    }

    renderHeroDOM(targetSi, targetIi);
    updateSectionNav(targetSi);
    updateItemDots(targetSi, targetIi);

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
  startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);
  if (queuedTarget) { const q = queuedTarget; queuedTarget = null; void goTo(q.sectionIdx, q.itemIdx, q.navOpts || {}); }
}

function onSlingshotCancel() { cancelSlingshot(); }

function cancelSlingshot() {
  transitionCanvas.style.display = 'none'; transitionCanvas.style.opacity = '1'; transitionCanvas.style.transition = '';
  const heroEl = heroContainer.firstElementChild;
  if (heroEl) { heroEl.style.visibility = 'visible'; heroEl.style.opacity = '1'; heroEl.style.transition = ''; }
  cleanupPull();
  startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);
  const section = getSection(currentSectionIdx), item = getItem(currentSectionIdx, currentItemIdx);
  if (section && item) try { window.__SPA_Views?.[section.id]?.onActivate?.(item.id); } catch (_) {}
}

function cleanupPull() {
  isPulling = false; isTransitioning = false; activeTarget = null;
  pullTargetSectionIdx = null; pullTargetItemIdx = null;
  pullFromSurface = null; pullToSurface = null;
  pullFromSurfacePromise = null; pullToSurfacePromise = null;
  pullPreviewParticles = null; pullPreviewParticlesBase = null;
  pullPreviewCanvasW = 0; pullPreviewCanvasH = 0;
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const isNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';
  if (isAsymptoteGameActive && window.__SPA_GameNav) { void gameNavigate(isNext ? 'next' : 'prev'); return; }
  const t = isNext ? getNextTarget(currentSectionIdx, currentItemIdx) : getPrevTarget(currentSectionIdx, currentItemIdx);
  if (t) goTo(t.sectionIdx, t.itemIdx, getDesktopNavOptions());
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

setupItemNav();
render();

const _initSection = getSection(0), _initItem = getItem(0, 0);
if (_initSection && _initItem) try { window.__SPA_Views?.[_initSection.id]?.onActivate?.(_initItem.id); } catch (_) {}

startCurrentHeroSurfaceTracking(0, 0);

initSlingshot(heroContainer, {
  onTap:     onSlingshotTap,
  onLock:    onSlingshotLock,
  onPull:    onSlingshotPull,
  onRelease: onSlingshotRelease,
  onCancel:  onSlingshotCancel
});
