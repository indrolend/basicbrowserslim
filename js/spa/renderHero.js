// renderHero.js — hero DOM rendering and click-action wiring
//
// Usage:
//   const hero = createHeroRenderer({ heroContainer });
//   hero.renderHeroDOM(sectionIdx, itemIdx);

import { getSection, getItem, getHeroSpec, getClickAction } from './spaData.js';

let _gifRestartSeq = 0;

export function createHeroRenderer({ heroContainer }) {
  let activeGifPlayer = null;

  function _isGifSrc(src) {
    return /\.gif(?:[?#]|$)/i.test(src || '');
  }

  function _buildRestartGifSrc(src) {
    const raw = String(src || '');
    if (!raw) return raw;
    const hashIndex = raw.indexOf('#');
    const base = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
    const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
    const sep = base.includes('?') ? '&' : '?';
    _gifRestartSeq += 1;
    return `${base}${sep}spa_gif_restart=${Date.now()}_${_gifRestartSeq}${hash}`;
  }

  function renderHeroDOM(si, ii) {
    // Stop the gifler player we own before wiping the container. Keeping this
    // reference avoids rediscovering the hidden canvas on every hero commit.
    if (activeGifPlayer) {
      try { activeGifPlayer.stop(); } catch (_) {}
      activeGifPlayer = null;
    }
    heroContainer.innerHTML = '';

    const section = getSection(si);
    const item    = getItem(si, ii);
    if (!section || !item) return;

    // Delegate to external view module if registered
    const viewModule = window.__SPA_Views?.[section.id];
    if (viewModule?.mount) { viewModule.mount(item.id, heroContainer); return; }

    const heroSpec    = getHeroSpec(si, ii);
    const clickAction = getClickAction(si, ii);

    const wrapper = document.createElement('div');
    wrapper.className = 'spa-hero';
    wrapper.setAttribute('draggable', 'false');
    wrapper.addEventListener('dragstart', (e) => e.preventDefault());

    if (clickAction) {
      wrapper.classList.add('spa-hero--linkable');
      wrapper.setAttribute('role', 'link');
      wrapper.setAttribute('tabindex', '0');
      wrapper.dataset.action = 'hero-action';
      wrapper.dataset.clickAction = clickAction;
    }

    if (heroSpec.kind === 'image') {
      if (_isGifSrc(heroSpec.src) && window.gifler) {
        const gifRenderSrc = _buildRestartGifSrc(heroSpec.src);
        // Display the GIF via <img> so it shows instantly after transitions
        // with no decode delay. A hidden gifler canvas runs in parallel,
        // driven by the same src, so it stays close to the same frame as the
        // visible image. The transition engine captures the gifler canvas for
        // frame-accurate FROM surfaces.
        const img = document.createElement('img');
        img.className = 'spa-hero-image';
        img.src       = gifRenderSrc;
        img.width     = 320;
        img.height    = 320;
        img.style.objectFit = 'contain';
        img.setAttribute('draggable', 'false');
        wrapper.appendChild(img);

        // Hidden canvas driven by gifler to capture the current displayed frame.
        // gifler.animate() auto-sizes the canvas to the GIF's logical dimensions and
        // composites each sub-rect update tile at the correct (frame.x, frame.y) offset,
        // producing an accurate full-frame buffer. The transition engine reads this canvas
        // to build a frame-accurate FROM surface for the particle transition.
        const gifCanvas = document.createElement('canvas');
        gifCanvas.className = 'spa-hero-canvas';
        gifCanvas.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;';
        gifCanvas._gifReady = false;
        wrapper.appendChild(gifCanvas);
        window.gifler(gifRenderSrc).get(function(animator) {
          // Guard: renderHeroDOM may have fired again before XHR resolved.
          if (!gifCanvas.isConnected) {
            try { animator.stop(); } catch (_) {}
            return;
          }
          animator.onDrawFrame = function(ctx, frame) {
            if (!frame?.buffer) return;
            ctx.drawImage(frame.buffer, frame.x, frame.y);
            gifCanvas._gifReady = true;
          };
          // animateInCanvas() resizes the canvas to the GIF's logical dimensions,
          // then starts the animation loop.
          animator.animateInCanvas(gifCanvas);
          activeGifPlayer = animator;
        });
      } else {
        const img = document.createElement('img');
        img.className = 'spa-hero-image';
        img.src       = heroSpec.src;
        img.width     = 320;
        img.height    = 320;
        img.style.objectFit = 'contain';
        img.setAttribute('draggable', 'false');
        wrapper.appendChild(img);
      }
    } else {
      wrapper.classList.add('spa-hero--text');
      const textEl = document.createElement('div');
      textEl.className   = 'spa-hero-text';
      textEl.textContent = heroSpec.text || item.label;
      wrapper.appendChild(textEl);
    }


    heroContainer.appendChild(wrapper);
  }

  return { renderHeroDOM };
}
