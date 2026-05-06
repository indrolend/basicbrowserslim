// main.js — application bootstrap
//
// Composes module instances and wires up the DOM.
// All state and lifecycle lives in appKernel.

import { rasterizeHero }         from './js/spa/rasterizeHero.js';
import { initSlingshot }         from './js/spa/slingshotGesture.js';
import { getSection, getItem }   from './js/spa/spaData.js';
import { createDesktopNavTracker } from './js/spa/navModel.js';
import { createNavRenderer }     from './js/spa/renderNav.js';
import { createHeroRenderer }    from './js/spa/renderHero.js';
import { createSurfaceManager }  from './js/spa/surfaceManager.js';
import { createTransitionKernel } from './js/spa/transitionKernel.js';
import { createAppKernel }       from './js/spa/appKernel.js';

// ─── DOM ──────────────────────────────────────────────────────────────────────

const heroContainer    = document.getElementById('spa-hero-container');
const transitionCanvas = document.getElementById('transition-canvas');
const transitionCtx    = transitionCanvas.getContext('2d');
const dotsContainer    = document.getElementById('spa-dots');

// ─── Module instances ─────────────────────────────────────────────────────────

const desktopNav = createDesktopNavTracker();

// Forward reference: heroRenderer needs kernel.onHeroAction, wired below.
let kernel;

const heroRenderer = createHeroRenderer({
  heroContainer,
  onAction: (action) => kernel.onHeroAction(action)
});

const navRenderer = createNavRenderer({
  dotsContainer,
  onNav: (si, ii) => kernel.goTo(si, ii)
});

const surfaceManager = createSurfaceManager({
  heroContainer,
  rasterizeHero,
  getIsTransitioning: () => kernel.isTransitioning()
});

const transitionKernel = createTransitionKernel({
  transitionCanvas, transitionCtx, heroContainer
});

kernel = createAppKernel({
  surfaceManager,
  transitionKernel,
  heroRenderer,
  navRenderer,
  rasterizeHero,
  heroContainer,
  desktopNav
});

// ─── Window API ───────────────────────────────────────────────────────────────

window.__SPA_SetGameMode = (active) => kernel.setGameActive(active);
window.__SPA_GoHome      = () => kernel.goTo(0, 0);
window.__SPA_ExitGameToCurrentItem             = () => void kernel.exitGameToCurrentItem();
window.__SPA_EnterCurrentGame                  = () => void kernel.enterCurrentGameWithTransition();
window.__SPA_RestoreCurrentItemHero            = () => kernel.restoreCurrentItemHero();
window.__SPA_CloseCurrentOverlayWithTransition = () => void kernel.closeOverlayWithTransition();
window.__SPA_CancelSlingshot                   = () => kernel.cancelSlingshot();

// ─── Keyboard navigation ──────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const direction = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 'next' : 'prev';
  kernel.navigate(direction, desktopNav.getNavOptions());
});

// ─── Item nav buttons ─────────────────────────────────────────────────────────

navRenderer.setupItemNav(
  document.getElementById('spa-prev-btn'),
  document.getElementById('spa-next-btn'),
  () => kernel.navigate('prev', desktopNav.getNavOptions()),
  () => kernel.navigate('next', desktopNav.getNavOptions())
);

// ─── Boot ─────────────────────────────────────────────────────────────────────

kernel.render();

const _initSection = getSection(0), _initItem = getItem(0, 0);
if (_initSection && _initItem) try { window.__SPA_Views?.[_initSection.id]?.onActivate?.(_initItem.id); } catch (_) {}

surfaceManager.startTracking(0, 0);

initSlingshot(heroContainer, {
  onTap:     () => kernel.onTap(),
  onLock:    (e) => kernel.onLock(e),
  onPull:    (e) => kernel.onPull(e),
  onRelease: (e) => kernel.onRelease(e),
  onCancel:  () => kernel.onCancel()
});
