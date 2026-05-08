// surfaceManager.js — hero surface rasterization and caching
//
// Owns:
//   - Building on-demand surfaces for 'from' and 'to' phases
//   - Caching the most recent surface per hero key (seeded once on startTracking)
//
// Does NOT own: particle sampling, canvas alignment, or transition lifecycle.
//
// Usage:
//   const sm = createSurfaceManager({ heroContainer, rasterizeHero });
//   sm.startTracking(si, ii);
//   sm.stopTracking();
//   const surface = await sm.buildSurface(si, ii, 'from');

import { getSection, getItem, getHeroSpec, getHeroSurfaceKey, isGifHero } from './spaData.js';

export function createSurfaceManager({ heroContainer, rasterizeHero }) {
  let _currentSurface = null;
  let _currentKey     = null;
  let _pendingKey     = null;
  let _pendingPromise = null;

  /**
   * Invalidate any pending background build so its result will be ignored when it resolves.
   * The existing cache is retained for use by goTo.
   */
  function stopTracking() {
    _pendingKey     = null;
    _pendingPromise = null;
  }

  /**
   * Seed the surface cache for (si, ii).
   * Clears any prior cached surface, then builds once asynchronously.
   * No RAF loop: the cache is populated on demand and invalidated explicitly.
   */
  function startTracking(si, ii) {
    _pendingKey     = null;
    _pendingPromise = null;
    _currentSurface = null;
    _currentKey     = null;

    // GIF and procedural heroes: no surface cache needed
    if (isGifHero(si, ii) || window.__SPA_Views?.[getSection(si)?.id]?.buildHeroProbe) {
      return;
    }

    const key = getHeroSurfaceKey(si, ii);
    _pendingKey     = key;
    _pendingPromise = _rasterize(si, ii, 'from');
    _pendingPromise.then(s => {
      if (_pendingKey !== key) return;
      _currentSurface = s;
      _currentKey     = key;
      _pendingKey     = null;
      _pendingPromise = null;
    }).catch(() => {
      if (_pendingKey === key) { _pendingKey = null; _pendingPromise = null; }
    });
  }

  function _buildRenderInput(si, ii, phase) {
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

  async function buildSurface(si, ii, phase) {
    const key = getHeroSurfaceKey(si, ii);
    if (phase === 'from' && !isGifHero(si, ii)) {
      // Cache hit
      if (_currentSurface && _currentKey === key) return _currentSurface;
      // Reuse the in-flight seed promise to avoid a second rasterizeHero call
      if (_pendingKey === key && _pendingPromise) return _pendingPromise;
    }
    return _rasterize(si, ii, phase);
  }

  async function _rasterize(si, ii, phase) {
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
