// surfaceManager.js — hero surface rasterization, tracking, and caching
//
// Replaces heroSurface.js with an explicit contract name.
//
// Owns:
//   - One-shot tracking of the live hero surface when idle
//   - Building on-demand surfaces for 'from' and 'to' phases
//   - Caching the most recent surface per hero key
//
// Does NOT own: particle sampling, canvas alignment, or transition lifecycle.
//
// Usage:
//   const sm = createSurfaceManager({ heroContainer, rasterizeHero, getIsTransitioning });
//   sm.startTracking(si, ii);
//   sm.stopTracking();
//   const surface = await sm.buildSurface(si, ii, 'from');

import { getSection, getItem, getHeroSpec, getHeroSurfaceKey, isGifHero } from './spaData.js';

export function createSurfaceManager({ heroContainer, rasterizeHero, getIsTransitioning }) {
  let _currentSurface    = null;
  let _currentKey        = null;
  let _trackingKey       = null;
  let _deferredPrimeFrameId = 0;

  function stopTracking() {
    if (_deferredPrimeFrameId) {
      cancelAnimationFrame(_deferredPrimeFrameId);
      _deferredPrimeFrameId = 0;
    }
    _trackingKey = null;
  }

  function startTracking(si, ii) {
    stopTracking();
    const key = getHeroSurfaceKey(si, ii);
    _trackingKey = key;

    // GIF and procedural heroes: no surface cache needed
    if (isGifHero(si, ii) || window.__SPA_Views?.[getSection(si)?.id]?.buildHeroProbe) {
      _currentSurface = null;
      _currentKey     = null;
      return;
    }

    function primeWhenIdle() {
      _deferredPrimeFrameId = 0;
      if (_trackingKey !== key) return;
      if (getIsTransitioning()) {
        _deferredPrimeFrameId = requestAnimationFrame(primeWhenIdle);
        return;
      }
      buildSurface(si, ii, 'from').then(s => {
        if (_trackingKey !== key) return;
        _currentSurface = s;
        _currentKey     = key;
      }).catch(() => {});
    }

    _deferredPrimeFrameId = requestAnimationFrame(primeWhenIdle);
  }

  function _buildRenderInput(si, ii, phase) {
    const section = getSection(si);
    const item    = getItem(si, ii);
    if (!section || !item) return null;

    const heroSpec   = getHeroSpec(si, ii);
    const viewModule = window.__SPA_Views?.[section.id];

    if (phase === 'from') {
      // GIF hero rendered by gifler — canvas holds the current frame once ready.
      // If the canvas is not ready yet, fall back to the visible <img> so
      // transitions still have a source surface instead of disappearing.
      const liveGifCanvas = heroContainer.querySelector('canvas.spa-hero-canvas');
      if (liveGifCanvas && liveGifCanvas._gifReady === true && liveGifCanvas.width > 0 && liveGifCanvas.height > 0) {
        return { type: 'element', element: liveGifCanvas };
      }

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

    // Build an offscreen probe that mirrors the exact DOM structure renderHeroDOM
    // produces for text heroes. This makes the rasterized surface use the same CSS
    // (font-size clamp, accent colour, letter-spacing) as the revealed hero, so the
    // particles converge into text that matches what actually appears.
    const probeWrap = document.createElement('div');
    probeWrap.className = 'spa-hero spa-hero--text';
    probeWrap.style.cssText =
      `position:absolute;left:-9999px;top:0;` +
      `width:${heroContainer.offsetWidth || 320}px;pointer-events:none;`;
    const probeText = document.createElement('div');
    probeText.className = 'spa-hero-text';
    probeText.textContent = heroSpec.text || item.label;
    probeWrap.appendChild(probeText);
    document.body.appendChild(probeWrap);
    return { type: 'textElement', element: probeWrap, cleanup: () => probeWrap.remove() };
  }

  async function buildSurface(si, ii, phase) {
    const key    = getHeroSurfaceKey(si, ii);
    const cached = phase === 'from' && _currentSurface && _currentKey === key && !isGifHero(si, ii);
    if (cached) return _currentSurface;

    const input = _buildRenderInput(si, ii, phase);
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

  return { startTracking, stopTracking, buildSurface };
}
