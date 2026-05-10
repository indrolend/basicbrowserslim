// overlayManager.js — sets window.__SPA_Overlay
// Interface: isOpen(), open(id, data), openInline(id, data, containerEl),
//            close(options), buildProbe(id, data, opts), shouldSuppressTap()
(function() {
  const root = document.getElementById('spa-overlay-root');
  let currentId = null;
  let inlineCleanup = null;
  let suppressTapUntil = 0;

  const OVERLAY_CONTENT = {
    soundcloud: {
      title: 'soundcloud',
      subtitle: 'Stream on SoundCloud',
      links: [
        { label: 'Open SoundCloud', href: 'https://soundcloud.com/indrolend' }
      ]
    },
    asymptote: {
      title: 'asymptote engine',
      subtitle: 'A game about limits',
      links: []
    }
  };

  function buildOverlayHTML(id) {
    const data = OVERLAY_CONTENT[id];
    if (!data) return null;
    const linksHTML = data.links.map(l =>
      `<a class="spa-overlay-link" href="${encodeURI(l.href)}" target="_blank" rel="noopener noreferrer">${l.label}</a>`
    ).join('');
    return `
      <div class="spa-overlay-title">${data.title}</div>
      <p class="spa-overlay-subtitle">${data.subtitle}</p>
      <div class="spa-overlay-links">${linksHTML}</div>
      <button type="button" class="spa-overlay-close">close</button>
    `;
  }

  function suppressTap() {
    suppressTapUntil = performance.now() + 350;
  }

  function requestOverlayClose() {
    if (typeof window.__SPA_Control?.closeCurrentOverlayWithTransition === 'function') {
      window.__SPA_Control.closeCurrentOverlayWithTransition();
    } else {
      api.close({ restore: true });
    }
  }

  const api = {
    isOpen() {
      return currentId !== null;
    },

    open(id) {
      if (!root) return;
      const html = buildOverlayHTML(id);
      if (!html) return;
      currentId = id;
      suppressTap();
      const panel = document.createElement('div');
      panel.className = 'spa-overlay';
      panel.innerHTML = html;
      root.innerHTML = '';
      root.appendChild(panel);
      root.style.display = 'block';
      const closeBtn = panel.querySelector('.spa-overlay-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => requestOverlayClose());
      }
      root.addEventListener('click', function onBgClick(e) {
        if (e.target === root) {
          requestOverlayClose();
          root.removeEventListener('click', onBgClick);
        }
      });
    },

    openInline(id, _data, containerEl) {
      if (!containerEl) return;
      if (inlineCleanup) { inlineCleanup(); inlineCleanup = null; }
      const html = buildOverlayHTML(id);
      if (!html) return;
      currentId = id;
      suppressTap();
      const panel = document.createElement('div');
      panel.className = 'spa-overlay spa-overlay--inline';
      panel.innerHTML = html;
      containerEl.innerHTML = '';
      containerEl.appendChild(panel);
      const closeBtn = panel.querySelector('.spa-overlay-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          requestOverlayClose();
        });
      }
      inlineCleanup = () => { containerEl.innerHTML = ''; currentId = null; };
    },

    close(options = {}) {
      currentId = null;
      if (inlineCleanup) { inlineCleanup(); inlineCleanup = null; }
      if (root) { root.style.display = 'none'; root.innerHTML = ''; }
      if (options.restore) {
        if (typeof window.__SPA_Control?.restoreCurrentItemHero === 'function') {
          window.__SPA_Control.restoreCurrentItemHero();
        }
      }
    },

    buildProbe(id, _data, opts = {}) {
      const html = buildOverlayHTML(id);
      if (!html) return null;
      const el = document.createElement('div');
      el.className = opts.inline ? 'spa-overlay spa-overlay--inline' : 'spa-overlay';
      el.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
      el.innerHTML = html;
      document.body.appendChild(el);
      return {
        element: el,
        cleanup() { el.remove(); }
      };
    },

    shouldSuppressTap() {
      return performance.now() < suppressTapUntil;
    }
  };

  window.__SPA_Overlay = api;
})();
