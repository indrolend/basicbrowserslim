// main.js — application bootstrap
//
// Composes module instances and wires up the DOM.
// All state and lifecycle lives in appKernel.

import { rasterizeHero }         from './js/spa/rasterizeHero.js';
import { initSlingshot }         from './js/spa/slingshotGesture.js';
import { createNavRenderer }     from './js/spa/renderNav.js';
import { createHeroRenderer }    from './js/spa/renderHero.js';
import { createSurfaceManager }  from './js/spa/surfaceManager.js';
import { createTransitionKernel } from './js/spa/transitionKernel.js';
import { createAppKernel }       from './js/spa/appKernel.js';

// ─── DOM ──────────────────────────────────────────────────────────────────────

const heroContainer    = document.getElementById('spa-hero-container');
const transitionCanvas = document.getElementById('transition-canvas');
const dotsContainer    = document.getElementById('spa-dots');

// ─── Module instances ─────────────────────────────────────────────────────────

let kernel;

const heroRenderer = createHeroRenderer({
  heroContainer
});

const navRenderer = createNavRenderer({
  dotsContainer
});

const surfaceManager = createSurfaceManager({
  heroContainer,
  rasterizeHero
});

const transitionKernel = createTransitionKernel({
  transitionCanvas, heroContainer
});

kernel = createAppKernel({
  surfaceManager,
  transitionKernel,
  heroRenderer,
  navRenderer,
  rasterizeHero,
  heroContainer
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

function safeParseInt(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function dispatchActionElement(el) {
  if (!el || el.hasAttribute?.('disabled') || el.disabled === true) return;
  const action = el.dataset.action;
  if (!action) return;

  if (action === 'navigate') {
    const direction = el.dataset.direction;
    if (direction === 'prev' || direction === 'next') kernel.navigate(direction);
    return;
  }

  if (action === 'goto-section') {
    const sectionIdx = safeParseInt(el.dataset.sectionIdx);
    if (sectionIdx !== null) void kernel.goTo(sectionIdx, 0);
    return;
  }

  if (action === 'goto-item') {
    const sectionIdx = safeParseInt(el.dataset.sectionIdx);
    const itemIdx = safeParseInt(el.dataset.itemIdx);
    if (sectionIdx !== null && itemIdx !== null) void kernel.goTo(sectionIdx, itemIdx);
    return;
  }

  if (action === 'hero-action') {
    const clickAction = el.dataset.clickAction;
    if (typeof clickAction === 'string' && clickAction.length > 0) kernel.onHeroAction(clickAction);
    return;
  }

  if (action === 'enter-game') {
    void kernel.enterCurrentGameWithTransition();
  }
}

document.addEventListener('click', (e) => {
  if (typeof e.button === 'number' && e.button !== 0) return;
  if (e.defaultPrevented) return;
  const target = e.target?.closest?.('[data-action]');
  if (!target) return;
  dispatchActionElement(target);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    kernel.navigate((e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 'next' : 'prev');
    return;
  }

  if (e.key !== 'Enter' && e.key !== ' ') return;
  const active = document.activeElement;
  if (!active?.matches?.('[data-action]')) return;
  e.preventDefault();
  dispatchActionElement(active);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

kernel.start();

initSlingshot(heroContainer, {
  onTap:     () => kernel.onTap(),
  onLock:    (e) => kernel.onLock(e),
  onPull:    (e) => kernel.onPull(e),
  onRelease: (e) => kernel.onRelease(e),
  onCancel:  () => kernel.onCancel()
});
