// Slingshot gesture — unified pointer-event pull interaction
// Works identically on touch and mouse: pointerdown → pointermove → pointerup.
// API: initSlingshot(element, callbacks) → { destroy }
// callbacks: { onArm, onLock, onPull, onRelease, onCancel, onTap }
// onLock may return false to reject the lock (e.g. SPA is mid-transition);
// the gesture resets so a stale pull never starts.

const LOCK_THRESHOLD_PX = 15;  // minimum drag before direction is committed
const MAX_PULL_DISTANCE  = 120; // px at which pullNormalized reaches 1.0
const TAP_SLOP_PX        = 8;  // max movement still considered a tap

export function initSlingshot(element, callbacks = {}) {
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

  // Move/up/cancel listeners are added to window (not element) so that events
  // are received even when setPointerCapture fails or the pointer leaves the
  // element boundary before LOCK_THRESHOLD_PX is crossed.
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

    // setPointerCapture routes captured events back to this element so they
    // continue to bubble up to our window listeners. If capture fails the
    // window listeners still receive all events — the fallback is seamless.
    try { element.setPointerCapture(e.pointerId); } catch (_e) { /* intentionally ignored */ }
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
        } catch (_err) { /* ignore */ }
        return;
      }
      return;
    }

    // phase === 'locked'
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
          try { onCancel(); } catch (_err) { /* no-op */ }
        }
      } else {
        // Pointer released without lock: only very small movement is a tap.
        if (savedArmedDistance <= TAP_SLOP_PX && typeof onTap === 'function') {
          try { onTap(); } catch (_err) { /* no-op */ }
        }
      }
      return;
    }

    if (typeof onRelease === 'function') {
      try {
        onRelease({ direction: savedDirection, pullVector: savedPullVector, pullNormalized: savedPullNormalized });
      } catch (_err) {
        if (typeof onCancel === 'function') {
          try { onCancel(); } catch (_err2) { /* no-op */ }
        }
      }
    }
  }

  function handlePointerUp(e) { finalize(e, false); }
  function handlePointerCancel(e) { finalize(e, true); }

  element.addEventListener('pointerdown', handlePointerDown);
  // pointermove / pointerup / pointercancel are registered on window dynamically
  // inside handlePointerDown and cleaned up inside finalize().

  return {
    destroy() {
      element.removeEventListener('pointerdown', handlePointerDown);
      // Cancel any in-progress gesture so callbacks and touchAction are cleaned up.
      if (phase !== 'idle') finalize(null, true);
      // Guard: remove window listeners in case finalize was already called.
      removeWindowListeners();
      element.style.touchAction = '';
      phase = 'idle';
      pointerId = null;
    }
  };
}
