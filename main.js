// main.js — application bootstrap
//
// Composes module instances and wires up the DOM.
// All state and lifecycle lives in appKernel.

import { rasterizeHero }         from './js/spa/rasterizeHero.js';
import { createTransitionKernel } from './js/spa/transitionKernel.js';
import { createAppKernel }       from './js/spa/appKernel.js';

// ─── DOM ──────────────────────────────────────────────────────────────────────

const spaRoot          = document.getElementById('spa-root');
const heroContainer    = document.getElementById('spa-hero-container');
const transitionCanvas = document.getElementById('transition-canvas');
const dotsContainer    = document.getElementById('spa-dots');
const overlayRoot      = document.getElementById('spa-overlay-root');

// ─── Module instances ─────────────────────────────────────────────────────

const transitionKernel = createTransitionKernel({
  transitionCanvas,
  heroContainer,
  spaRoot
});

const kernel = createAppKernel({
  transitionKernel,
  rasterizeHero,
  heroContainer,
  dotsContainer,
  overlayRoot
});

// ─── Window API ───────────────────────────────────────────────────────────────

window.__SPA_Control = {
  restoreCurrentItemHero:            () => kernel.dispatchInputIntent('restore-current-item-hero'),
  closeCurrentOverlayWithTransition: () => kernel.dispatchInputIntent('close-overlay'),
  cancelSlingshot:                   () => kernel.dispatchInputIntent('cancel-slingshot')
};

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
    kernel.dispatchInputIntent('navigate', { direction });
    return;
  }

  if (action === 'goto-section') {
    const sectionIdx = safeParseInt(el.dataset.sectionIdx);
    if (sectionIdx !== null) kernel.dispatchInputIntent('goto', { sectionIdx, itemIdx: 0 });
    return;
  }

  if (action === 'goto-item') {
    const sectionIdx = safeParseInt(el.dataset.sectionIdx);
    const itemIdx = safeParseInt(el.dataset.itemIdx);
    if (sectionIdx !== null && itemIdx !== null) kernel.dispatchInputIntent('goto', { sectionIdx, itemIdx });
    return;
  }

  if (action === 'hero-action') {
    const clickAction = el.dataset.clickAction;
    kernel.dispatchInputIntent('hero-action', { clickAction });
    return;
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
    kernel.dispatchInputIntent('navigate', {
      direction: (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 'next' : 'prev'
    });
    return;
  }

  if (e.key === 'Escape') {
    kernel.dispatchInputIntent('close-overlay');
    return;
  }

  if (e.key !== 'Enter' && e.key !== ' ') return;
  const active = document.activeElement;
  if (!active?.matches?.('[data-action]')) return;
  e.preventDefault();
  dispatchActionElement(active);
});

// ─── Slingshot gesture ───────────────────────────────────────────────────────

const LOCK_THRESHOLD_PX = 15;  // minimum drag before direction is committed
const MAX_PULL_DISTANCE  = 120; // px at which pullNormalized reaches 1.0
const TAP_SLOP_PX        = 8;  // max movement still considered a tap

function initSlingshot(element, callbacks = {}) {
  const { onArm, onLock, onPull, onRelease, onCancel, onTap } = callbacks;

  let phase = 'idle'; // idle | armed | locked
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lockedDirection = null;
  let lastPullVector = { x: 0, y: 0 };
  let lastPullNormalized = 0;
  let armedDistance = 0;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dist(dx, dy) { return Math.sqrt(dx * dx + dy * dy); }

  function addWindowListeners() {
    window.addEventListener('pointermove',   handlePointerMove);
    window.addEventListener('pointerup',     handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  }

  function removeWindowListeners() {
    window.removeEventListener('pointermove',   handlePointerMove);
    window.removeEventListener('pointerup',     handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
  }

  function handlePointerDown(e) {
    if (phase !== 'idle') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const targetEl = e.target;
    if (
      targetEl instanceof Element &&
      targetEl.closest('button, a, input, textarea, select, [data-spa-no-sling="true"]')
    ) {
      return;
    }

    if (e.cancelable) e.preventDefault();

    phase = 'armed';
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    lastPullVector = { x: 0, y: 0 };
    lastPullNormalized = 0;
    lockedDirection = null;
    armedDistance = 0;

    try { element.setPointerCapture(e.pointerId); } catch (_e) { }
    element.style.touchAction = 'none';
    addWindowListeners();

    if (typeof onArm === 'function') onArm();
  }

  function handlePointerMove(e) {
    if (e.pointerId !== pointerId) return;
    if (phase !== 'armed' && phase !== 'locked') return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const d = dist(dx, dy);
    armedDistance = d;

    if (phase === 'armed') {
      if (d < LOCK_THRESHOLD_PX) return;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      lockedDirection = adx >= ady ? (dx < 0 ? 'next' : 'prev') : (dy < 0 ? 'next' : 'prev');
      lastPullVector = { x: dx, y: dy };
      lastPullNormalized = clamp(d / MAX_PULL_DISTANCE, 0, 1);
      phase = 'locked';
      let lockAccepted = true;
      if (typeof onLock === 'function') {
        try {
          lockAccepted = onLock({
            direction: lockedDirection,
            pullVector: lastPullVector,
            pullNormalized: lastPullNormalized
          }) !== false;
        } catch (_err) {
          lockAccepted = false;
        }
      }
      if (!lockAccepted) {
        phase = 'idle';
        pointerId = null;
        lockedDirection = null;
        removeWindowListeners();
        element.style.touchAction = '';
        try {
          if (e.pointerId != null) element.releasePointerCapture(e.pointerId);
        } catch (_err) { }
        return;
      }
      return;
    }

    lastPullVector = { x: dx, y: dy };
    lastPullNormalized = clamp(d / MAX_PULL_DISTANCE, 0, 1);
    if (typeof onPull === 'function') {
      try {
        onPull({ pullVector: lastPullVector, pullNormalized: lastPullNormalized });
      } catch (_err) {
        finalize(e, true);
      }
    }
  }

  function finalize(e, isCancelled) {
    if (e && e.pointerId !== pointerId) return;
    if (phase === 'idle') return;

    removeWindowListeners();
    element.style.touchAction = '';
    const wasLocked = phase === 'locked';
    const savedArmedDistance = armedDistance;
    const savedDirection = lockedDirection;
    const savedPullVector = { ...lastPullVector };
    const savedPullNormalized = lastPullNormalized;

    phase = 'idle';
    pointerId = null;
    lockedDirection = null;
    armedDistance = 0;

    if (isCancelled || !wasLocked) {
      if (isCancelled) {
        if (typeof onCancel === 'function') {
          try { onCancel(); } catch (_err) { }
        }
      } else {
        if (savedArmedDistance <= TAP_SLOP_PX && typeof onTap === 'function') {
          try { onTap(); } catch (_err) { }
        }
      }
      return;
    }

    if (typeof onRelease === 'function') {
      try {
        onRelease({ direction: savedDirection, pullVector: savedPullVector, pullNormalized: savedPullNormalized });
      } catch (_err) {
        if (typeof onCancel === 'function') {
          try { onCancel(); } catch (_err2) { }
        }
      }
    }
  }

  function handlePointerUp(e) { finalize(e, false); }
  function handlePointerCancel(e) { finalize(e, true); }

  element.addEventListener('pointerdown', handlePointerDown);

  return {
    destroy() {
      element.removeEventListener('pointerdown', handlePointerDown);
      if (phase !== 'idle') finalize(null, true);
      removeWindowListeners();
      element.style.touchAction = '';
      phase = 'idle';
      pointerId = null;
    }
  };
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

kernel.start();

initSlingshot(heroContainer, {
  onTap:     () => kernel.onTap(),
  onLock:    (e) => kernel.onLock(e),
  onPull:    (e) => kernel.onPull(e),
  onRelease: (e) => kernel.onRelease(e),
  onCancel:  () => kernel.onCancel()
});
