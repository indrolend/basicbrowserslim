// runtimeModules.js — lazy activation boundaries for optional browser machinery

const _scriptPromises = new Map();
const APP_ROOT = new URL('../../', import.meta.url);

function _scriptReady(ready) {
  try { return typeof ready === 'function' && ready(); } catch (_) { return false; }
}

export function loadScriptOnce(src, ready) {
  const url = new URL(src, APP_ROOT).href;
  if (_scriptReady(ready)) return Promise.resolve();
  if (_scriptPromises.has(url)) return _scriptPromises.get(url);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => {
      _scriptPromises.delete(url);
      reject(new Error(`Failed to load ${url}`));
    };
    document.head.appendChild(script);
  }).then(() => {
    if (ready && !_scriptReady(ready)) {
      _scriptPromises.delete(url);
      throw new Error(`${url} loaded but runtime was not registered`);
    }
  });

  _scriptPromises.set(url, promise);
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
<<<<<<< HEAD
  await loadScriptOnce('js/spa/apps/asymptoteApp.js', () => !!window.AsymptoteApp);
  await loadScriptOnce('js/spa/views/gamesView.js', () => !!window.__SPA_Views?.games);
=======
  await loadScriptOnce('js/spa/apps/asymptoteApp.js');
  await loadScriptOnce('js/spa/views/gamesView.js', () => !!window.__SPA_Views?.games && !!window.__SPA_GameNav);
>>>>>>> b57078b (Runtime reduction and continuity hardening)
}
