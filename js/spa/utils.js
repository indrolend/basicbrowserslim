// utils.js — shared SPA utility helpers

export function waitRaf()  { return new Promise(resolve => requestAnimationFrame(resolve)); }
export function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export function getSafeExternalUrl(href) {
  try {
    const url = new URL(href, window.location.origin);
    if (url.protocol === 'https:') return url.href;
  } catch (_) {}
  return null;
}
