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

  function createOverlayElement(id, opts = {}) {
    const html = buildOverlayHTML(id);
    if (!html) return null;
    const panel = document.createElement('div');
    panel.className = opts.inline ? 'spa-overlay spa-overlay--inline' : 'spa-overlay';
    if (opts.hidden) {
      panel.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
    }
    panel.innerHTML = html;
    return panel;
  }

  function suppressTap() {
    suppressTapUntil = performance.now() + 350;
  }

  const api = {
    isOpen() {
      return currentId !== null;
    },

    open(id) {
      if (!root) return;
      const panel = createOverlayElement(id);
      if (!panel) return;
      currentId = id;
      suppressTap();
      root.innerHTML = '';
      root.appendChild(panel);
      root.style.display = 'block';
      const closeBtn = panel.querySelector('.spa-overlay-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => api.close({ restore: true }));
      }
      root.addEventListener('click', function onBgClick(e) {
        if (e.target === root) {
          api.close({ restore: true });
          root.removeEventListener('click', onBgClick);
        }
      });
    },

    openInline(id, _data, containerEl) {
      if (!containerEl) return;
      if (inlineCleanup) { inlineCleanup(); inlineCleanup = null; }
      const panel = createOverlayElement(id, { inline: true });
      if (!panel) return;
      currentId = id;
      suppressTap();
      containerEl.innerHTML = '';
      containerEl.appendChild(panel);
      const closeBtn = panel.querySelector('.spa-overlay-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          if (typeof window.__SPA_CloseCurrentOverlayWithTransition === 'function') {
            window.__SPA_CloseCurrentOverlayWithTransition();
          } else {
            api.close({ restore: true });
          }
        });
      }
      inlineCleanup = () => { containerEl.innerHTML = ''; currentId = null; };
    },

    close(options = {}) {
      currentId = null;
      if (inlineCleanup) { inlineCleanup(); inlineCleanup = null; }
      if (root) { root.style.display = 'none'; root.innerHTML = ''; }
      if (options.restore) {
        if (typeof window.__SPA_RestoreCurrentItemHero === 'function') {
          window.__SPA_RestoreCurrentItemHero();
        }
      }
    },

    buildProbe(id, _data, opts = {}) {
      const el = createOverlayElement(id, { inline: !!opts.inline, hidden: true });
      if (!el) return null;
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
