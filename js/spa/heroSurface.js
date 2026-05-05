// heroSurface.js — hero surface capture, rasterization, and RAF tracking
//
// Usage:
//   const hs = createHeroSurface({ heroContainer, rasterizeHero, getIsTransitioning });
//   hs.startTracking(si, ii);
//   hs.stopTracking();
//   const surface = await hs.buildHeroSurface(si, ii, 'from');

import { getSection, getItem, getHeroSpec, getHeroSurfaceKey, isGifHero } from './spaData.js';

export function createHeroSurface({ heroContainer, rasterizeHero, getIsTransitioning }) {
  let currentSurface     = null;
  let currentSurfaceKey  = null;
  let currentFrameId     = null;
  let currentTrackingKey = null;

  function stopTracking() {
    if (currentFrameId) { cancelAnimationFrame(currentFrameId); currentFrameId = null; }
    currentTrackingKey = null;
  }

  function startTracking(si, ii) {
    stopTracking();
    const key = getHeroSurfaceKey(si, ii);
    currentTrackingKey = key;

    // GIF and procedural heroes: no surface cache needed
    if (isGifHero(si, ii) || window.__SPA_Views?.[getSection(si)?.id]?.buildHeroProbe) {
      currentSurface    = null;
      currentSurfaceKey = null;
      return;
    }

    function refresh() {
      buildHeroSurface(si, ii, 'from').then(s => {
        if (currentTrackingKey !== key) return;
        currentSurface    = s;
        currentSurfaceKey = key;
      }).catch(() => {});
    }

    function loop() {
      if (currentTrackingKey !== key) return;
      if (!getIsTransitioning()) refresh();
      currentFrameId = requestAnimationFrame(loop);
    }
    currentFrameId = requestAnimationFrame(loop);
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
    const key    = getHeroSurfaceKey(si, ii);
    const cached = phase === 'from' && currentSurface && currentSurfaceKey === key && !isGifHero(si, ii);
    if (cached) return currentSurface;

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

  return { stopTracking, startTracking, buildHeroRenderInput, buildHeroSurface };
}
