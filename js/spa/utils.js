// utils.js — shared SPA utility helpers

export function addActivationHandler(element, handler) {
  let touchFired = false;
  element.addEventListener('touchend', (e) => {
    touchFired = true;
    e.preventDefault();
    handler(e);
    setTimeout(() => { touchFired = false; }, 600);
  });
  element.addEventListener('click', (e) => { if (!touchFired) handler(e); });
}

export function waitRaf()  { return new Promise(resolve => requestAnimationFrame(resolve)); }
export function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export function getSafeExternalUrl(href) {
  try {
    const url = new URL(href, window.location.origin);
    if (url.protocol === 'https:') return url.href;
  } catch (_) {}
  return null;
}
