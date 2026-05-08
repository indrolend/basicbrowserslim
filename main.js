// main.js — application bootstrap
//
// Composes module instances and wires up the DOM.
// All state and lifecycle lives in appKernel.

import { rasterizeHero }         from './js/spa/rasterizeHero.js';
import { initSlingshot }         from './js/spa/slingshotGesture.js';
import { getSection, getItem }   from './js/spa/spaData.js';
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

let kernel;

const heroRenderer = createHeroRenderer({
  heroContainer
});

const navRenderer = createNavRenderer({
  dotsContainer
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

function parseIntData(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function dispatchActionElement(el) {
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  if (!action) return;

  if (action === 'navigate') {
    const direction = el.dataset.direction;
    if (direction === 'prev' || direction === 'next') kernel.navigate(direction);
    return;
  }

  if (action === 'goto-section') {
    const sectionIdx = parseIntData(el.dataset.sectionIdx);
    if (sectionIdx !== null) void kernel.goTo(sectionIdx, 0);
    return;
  }

  if (action === 'goto-item') {
    const sectionIdx = parseIntData(el.dataset.sectionIdx);
    const itemIdx = parseIntData(el.dataset.itemIdx);
    if (sectionIdx !== null && itemIdx !== null) void kernel.goTo(sectionIdx, itemIdx);
    return;
  }

  if (action === 'hero-action') {
    const clickAction = el.dataset.clickAction;
    if (clickAction) kernel.onHeroAction(clickAction);
  }
}

document.addEventListener('click', (e) => {
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

const prevBtn = document.getElementById('spa-prev-btn');
const nextBtn = document.getElementById('spa-next-btn');
if (prevBtn) {
  prevBtn.dataset.action = 'navigate';
  prevBtn.dataset.direction = 'prev';
}
if (nextBtn) {
  nextBtn.dataset.action = 'navigate';
  nextBtn.dataset.direction = 'next';
}

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
