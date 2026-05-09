// runtimeModules.js — lazy activation boundaries for optional browser machinery

const _scriptPromises = new Map();

function _scriptReady(ready) {
  try { return typeof ready === 'function' && ready(); } catch (_) { return false; }
}

export function loadScriptOnce(src, ready) {
  if (_scriptReady(ready)) return Promise.resolve();
  if (_scriptPromises.has(src)) return _scriptPromises.get(src);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => {
      _scriptPromises.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(script);
  }).then(() => {
    if (ready && !_scriptReady(ready)) {
      _scriptPromises.delete(src);
      throw new Error(`${src} loaded but runtime was not registered`);
    }
  });

  _scriptPromises.set(src, promise);
  return promise;
}

export function ensureGifRuntime() {
  return loadScriptOnce('js/vendor/gifler.min.js', () => typeof window.gifler === 'function');
}

export function ensureOverlayRuntime() {
  return loadScriptOnce('js/spa/overlayManager.js', () => !!window.__SPA_Overlay);
}

export async function ensureSectionRuntime(sectionId) {
  if (sectionId !== 'games') return;
  await loadScriptOnce('js/spa/apps/asymptoteApp.js');
  await loadScriptOnce('js/spa/views/gamesView.js', () => !!window.__SPA_Views?.games && !!window.__SPA_GameNav);
}
