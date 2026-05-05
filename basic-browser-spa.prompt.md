# basic-browser-spa — Full Architecture Reconstruction Prompt

Recreate the complete `basic-browser-spa` SPA from scratch.
No bundler, no framework, no npm. Vanilla JS ES modules served as static files.
Match every constant, interface contract, and behavioral detail described below.

---

## Directory layout

```
index.html
main.js                         ← entry point (type="module")
style.css
js/
  spa/
    rasterizeHero.js            ← ES module export
    particleTransitionEngine.js ← ES module export
    slingshotGesture.js         ← ES module export
    routes.js                   ← classic <script> global
    overlayManager.js           ← classic <script> global
    apps/
      asymptoteApp.js           ← classic <script> global
    views/
      gamesView.js              ← classic <script> global
    vendor/
      gifler.min.js             ← vendor (not authored)
gifs/
  Tiktoklogospin.gif
  Instagramlogospin.gif
  Youtubelogospin.gif
  Spotifylogospin.gif
  Applemusiclogospin.gif
  bandcamplogospin.gif
  soundcloudlogospin.gif
```

---

## index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self'; connect-src 'self';
             img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline';
             object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'">
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="X-Frame-Options" content="DENY">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>Homedev SPA</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="spa-root">
    <div id="spa-hero-container"></div>
    <canvas id="transition-canvas" width="320" height="320"
      style="display:none;position:absolute;z-index:100;pointer-events:none;"></canvas>
    <div id="spa-dots" role="tablist" aria-label="Item position"></div>
    <div id="spa-item-nav">
      <button type="button" id="spa-prev-btn" class="spa-nav-btn" aria-label="Previous item">← Prev</button>
      <button type="button" id="spa-next-btn" class="spa-nav-btn" aria-label="Next item">Next →</button>
    </div>
  </div>
  <div id="spa-overlay-root" role="dialog" aria-modal="true" aria-label="Overlay"></div>
  <script src="js/spa/routes.js"></script>
  <script src="js/spa/overlayManager.js"></script>
  <script src="js/spa/apps/asymptoteApp.js"></script>
  <script src="js/spa/views/gamesView.js"></script>
  <script type="module" src="main.js"></script>
</body>
</html>
```

---

## style.css

### CSS variables and reset

```css
:root {
  --bg: #111; --fg: #f0f0f0; --accent: #5ee87d;
  --panel: #222; --panel-active: #333;
}
* { box-sizing: border-box; }
html, body { touch-action: manipulation; }
body {
  background: var(--bg); color: var(--fg); margin: 0;
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  height: 100vh; height: 100svh; overflow: hidden;
}
```

### Layout skeleton

```css
#spa-section-nav {
  position: fixed; top: 0; left: 0; width: 100%; z-index: 20;
  display: flex; justify-content: center; flex-wrap: wrap;
  gap: 0.75rem; padding: 0.75rem;
  background: var(--bg); box-shadow: 0 2px 12px #0006;
}
#spa-root {
  position: relative; height: 100vh; height: 100svh;
  display: flex; flex-direction: column; width: 100%;
  padding: 4.6rem 1rem 0.9rem; overflow: hidden;
}
#spa-hero-container {
  flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  width: 100%; touch-action: none;
}
#spa-item-nav {
  width: 100%; display: flex; justify-content: center;
  gap: 0.75rem; margin: 0.75rem 0 0;
  position: relative; z-index: 11; flex-wrap: wrap; padding: 0 0.5rem;
}
#spa-dots {
  width: 100%; display: flex; justify-content: center;
  align-items: center; gap: 0.45rem; margin: 0.6rem 0 0; min-height: 12px;
}
```

### Hero components

```css
/* Dot navigation */
.spa-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #444; border: none; padding: 0; cursor: pointer;
  transition: background 0.2s, transform 0.2s; flex-shrink: 0;
}
.spa-dot[aria-selected="true"] { background: var(--accent); transform: scale(1.35); }

/* Hero container */
.spa-hero {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; width: min(100%, 38rem);
  min-height: 320px; text-align: center; cursor: grab;
}
.spa-hero:active { cursor: grabbing; }
.spa-hero--linkable { cursor: pointer; }
.spa-hero--linkable:active { cursor: pointer; }
.spa-hero--linkable:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 6px; border-radius: 16px;
}

/* Text hero */
.spa-hero--text {
  background: transparent; border: 2px solid transparent;
  border-radius: 12px; padding: 2rem 2.5rem; min-height: unset;
  box-shadow: none; transition: background 0.15s, border-color 0.15s;
  user-select: none; touch-action: manipulation;
}
.spa-hero--text:hover { background: transparent; border-color: transparent; }

/* GIF hero with link */
.spa-hero--gif-linkable {
  padding: 1.25rem; border: 2px solid transparent;
  border-radius: 20px; background: transparent; min-height: unset;
  transition: border-color 0.18s, background 0.18s;
}
.spa-hero--gif-linkable:hover, .spa-hero--gif-linkable:active {
  border-color: transparent; background: transparent;
}

/* Media */
.spa-hero-image, .spa-hero-gif { width: min(80vw, 320px); height: auto; max-height: 60vh; border-radius: 16px; }
.spa-hero-image { background: transparent; box-shadow: 0 4px 32px #000a; }
.spa-hero-gif   { background: transparent; box-shadow: none; border-radius: 0; }

.spa-hero-text {
  font-size: clamp(1.8rem, 5vw, 2.5rem); color: var(--accent);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin: 1.25rem 0; text-align: center;
}

/* Nav buttons */
.spa-nav-btn {
  background: var(--panel); color: var(--accent); border: 1px solid #2f2f2f;
  border-radius: 10px; padding: 0.75rem 1rem; margin: 0;
  min-height: 44px; min-width: 44px; font-size: 1rem; line-height: 1.2;
  cursor: pointer; touch-action: manipulation; transition: background 0.2s;
}
.spa-nav-btn:hover, .spa-nav-btn:active { background: var(--panel-active); }
.spa-nav-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Transition canvas: absolute, centered on hero via transform */
#transition-canvas {
  display: none; position: absolute; transform: translate(-50%, -50%);
}
```

### Overlay modal

```css
#spa-overlay-root {
  position: fixed; inset: 0; display: none; z-index: 120;
  background: rgba(0,0,0,0.68); backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px); padding: 1rem;
}
.spa-overlay {
  width: min(92vw, 32rem); margin: min(14vh, 8rem) auto 0;
  background: linear-gradient(180deg, #1b1b1b 0%, #141414 100%);
  border: 1px solid #2f2f2f; border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.55); padding: 1rem;
}
.spa-overlay--inline {
  width: min(100%, 38rem); min-height: 320px; margin: 0 auto;
  display: flex; flex-direction: column; justify-content: center;
  padding: 1rem 1rem 1.1rem; box-shadow: 0 10px 34px rgba(0,0,0,0.38);
}
.spa-overlay-title { font-size: clamp(1.35rem, 4vw, 1.8rem); text-transform: lowercase; letter-spacing: 0.06em; margin-bottom: 0.35rem; }
.spa-overlay-subtitle { margin: 0; color: #9aa19b; font-size: 0.9rem; letter-spacing: 0.03em; }
.spa-overlay-links { margin-top: 0.9rem; display: grid; gap: 0.55rem; }
.spa-overlay-link {
  display: block; color: var(--accent); text-decoration: none;
  background: #1f1f1f; border: 1px solid #2f2f2f; border-radius: 10px;
  padding: 0.7rem 0.8rem; letter-spacing: 0.03em;
  transition: background 0.18s ease, border-color 0.18s ease;
}
.spa-overlay-link:hover, .spa-overlay-link:focus-visible { background: #282828; border-color: #3e6b49; outline: none; }
.spa-overlay-close {
  margin-top: 0.85rem; width: 100%; min-height: 44px;
  border-radius: 10px; border: 1px solid #345a3d; background: #1f2b22;
  color: var(--accent); font: inherit; cursor: pointer;
}
.spa-overlay-close:hover, .spa-overlay-close:focus-visible { background: #27342a; border-color: #3e6b49; outline: none; }
```

### Mobile breakpoint (max-width: 768px)

Reduce `#spa-root` padding to `4.1rem 0.7rem 0.65rem`.
Section nav: `justify-content: flex-start`, smaller gaps.
`.spa-hero`: `min-height: 240px`.
`.spa-hero-image, .spa-hero-gif`: `width: min(86vw, 320px); max-height: 50vh`.

---

## js/spa/rasterizeHero.js  — ES module

**Export:** `export function rasterizeHero(hero)` → `Promise<Surface>`

**Surface shape:** `{ canvas: HTMLCanvasElement, offsetX, offsetY, width, height, hasVisibleContent }`

**Constants:** `HERO_CANVAS_WIDTH = 320`, `HERO_CANVAS_HEIGHT = 320`, `TEXT_RASTER_CANVAS_PADDING = 32`

### Input types

| `hero.type` | Required fields | Behaviour |
|---|---|---|
| `'gif'` | `src` | Load via `new Image()`, draw centered, `skipCrop: true` (preserve full frame) |
| `'element'` | `element` (HTMLImageElement or HTMLCanvasElement) | Canvas: draw centered, `skipCrop: true`. Img: draw centered, crop with `padding: 0` |
| `'textElement'` | `element` (HTMLElement) | SVG foreignObject path first; canvas fallback. `padding: 14`. `skipCrop: true` if element contains a `<canvas>` child |
| `'text'` | `text` | Draw directly on 320×320 canvas with `700 40px SF Mono` font, `#5ee87d` fill, center/middle alignment |

### SVG rasterization (textElement primary path)

1. Clone element, call `inlineComputedStyles(source, clone)` (recursive `getComputedStyle` copy).
2. Reset clone positioning: `margin:0; position:relative; left:auto; top:auto`.
3. Serialize with `XMLSerializer`, replace `&nbsp;` → `&#160;`.
4. Wrap in `<svg><foreignObject><div xmlns="xhtml">…</div></foreignObject></svg>`.
5. Set as `img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)`.
6. On `img.onload`: draw centered, then `compositeCanvasChildren` with `destination-over` to composite live canvases behind the text.

### `cropToContent(canvas, padding = 0)`

Scan ImageData, find opaque bbox (alpha > 32), add padding, return cropped canvas with `offsetX/Y/width/height`. If no opaque pixels, return original with `hasVisibleContent: false`.

### Canvas sizing

- `textElement`: use `getBoundingClientRect()`, add `TEXT_RASTER_CANVAS_PADDING * 2` each axis, floor to at least `HERO_CANVAS_WIDTH / HERO_CANVAS_HEIGHT`.
- `text` fallback: measure text with canvas ctx, width = measured + padding * 2, height = `HERO_CANVAS_HEIGHT`.

---

## js/spa/particleTransitionEngine.js  — ES module

**Exports:**
- `transition(fromCanvas, toCanvas, options, onComplete)`
- `transitionFromPull(pulledParticles, toRegion, ctx, options, onComplete)`

**Constants:** `PARTICLE_SIZE = 4`

### Surface shape (region)

`{ canvas: HTMLCanvasElement, width: number, height: number }` (plus `offsetX/offsetY` from rasterizeHero, ignored by engine).

### `sampleParticles(region, canvasWidth, canvasHeight)`

Draw region centered on a scratch canvas (reused across calls), read ImageData, collect `{ x, y, color: 'rgba(r,g,b,a)' }` for every `PARTICLE_SIZE` grid cell with alpha > 32.

### Helpers

- `shuffle(arr)` — Fisher-Yates in-place copy.
- `parseRgba(color)` → `[r, g, b, a]`.
- `lerpColor(from, to, t)` → interpolated `rgba(...)` string.
- `easeOutBack(t)` — `const s = 1.1; const u = t-1; return 1 + (s+1)*u*u*u + s*u*u`.
- `sampleByCoverage(list, count)` — evenly spaced indices into list.

### `transition` — explode → reform

```
PARTICLE_COUNT = floor((max(fromW, toW) * max(fromH, toH)) / (PARTICLE_SIZE²))
timingProfile: 'default' | 'chained' | 'releaseLike'
EXPLODE_DURATION: chained=80ms, default=120ms
REFORM_DURATION:  chained=160ms, default=230ms
TOTAL = EXPLODE + REFORM
EXPLODE_RADIUS = min(w,h) * (chained ? 0.34 : 0.4)
```

Phase 1 (t < EXPLODE_DURATION): particles move from `(x0,y0)` → `(ex,ey)` where ex/ey = start + random angle * radius.
Phase 2 (t < TOTAL): particles move from `(ex,ey)` → `(x1,y1)` with `easeOutBack`, color lerped from c0→c1.

If canvas is disconnected mid-animation, call `safeComplete()` immediately.

### `transitionFromPull` — reform only

```
SNAP_DURATION  =  80ms   (pull positions → rest positions, ease-out-quad)
REFORM_DURATION = 270ms   (rest → target, easeOutBack, color lerp)
```

Input: `pulledParticles` (last pull frame), `toRegion`, `ctx`, `options.fromParticlesBase` (rest positions).
N = max(pulledParticles.length, rawToParticles.length).
Phase 1 present only when `fromParticlesBase` provided and non-empty.
Phase 2: `pt.xm → pt.x1` via `easeOutBack`.

---

## js/spa/slingshotGesture.js  — ES module

**Export:** `export function initSlingshot(element, callbacks)` → `{ destroy() }`

**Constants:**
```
LOCK_THRESHOLD_PX = 15
MAX_PULL_DISTANCE  = 120
TAP_SLOP_PX        = 8
```

**Phases:** `'idle'` → `'armed'` → `'locked'`

**Direction lock rule:** `if (abs(dx) >= abs(dy))` → horizontal → `dx < 0` ? `'next'` : `'prev'`. Else vertical → `dy < 0` ? `'next'` : `'prev'`.

### Pointer event flow

1. `pointerdown` on element: skip if non-primary mouse button or if target is inside `button, a, input, textarea, select, [data-spa-no-sling="true"]`. Call `e.preventDefault()`. Set `phase='armed'`. `setPointerCapture` (ignore errors). Add `pointermove/pointerup/pointercancel` to **window** (not element).
2. `pointermove`: if `phase==='armed'` and `d >= LOCK_THRESHOLD_PX` → lock direction, `phase='locked'`, call `onLock({ direction, pullVector, pullNormalized })`. If `onLock` returns `false` → reset to idle. If `phase==='locked'` → call `onPull`.
3. `pointerup` → `finalize(e, false)`.
4. `pointercancel` → `finalize(e, true)`.

### `finalize(e, isCancelled)`

- Remove window listeners, restore `touchAction = ''`.
- If cancelled: call `onCancel`.
- If released without lock: if `armedDistance <= TAP_SLOP_PX` → call `onTap`.
- If released from lock: call `onRelease({ direction, pullVector, pullNormalized })`.

### `destroy()`

Remove `pointerdown` listener, call `finalize(null, true)` if not idle, remove window listeners, reset state.

---

## main.js  — entry point (type="module")

Imports at bottom of file (after all function declarations):
```js
import { rasterizeHero } from './js/spa/rasterizeHero.js';
import { transition, transitionFromPull } from './js/spa/particleTransitionEngine.js';
import { initSlingshot } from './js/spa/slingshotGesture.js';
```

### SPA_SECTIONS (data)

```js
const SPA_SECTIONS = [
  { id: 'home',   label: 'Home',
    items: [{ id: 'swipe', label: 'Swipe', hero: { kind: 'text', text: 'swipe' } }]
  },
  { id: 'social', label: 'Social',
    items: [
      { id: 'tiktok',    label: 'TikTok',     hero: { kind: 'image', src: 'gifs/Tiktoklogospin.gif' } },
      { id: 'instagram', label: 'Instagram',  hero: { kind: 'image', src: 'gifs/Instagramlogospin.gif' } },
      { id: 'youtube',   label: 'YouTube',    hero: { kind: 'image', src: 'gifs/Youtubelogospin.gif' } }
    ]
  },
  { id: 'music',  label: 'Music',
    items: [
      { id: 'spotify',    label: 'Spotify',     hero: { kind: 'image', src: 'gifs/Spotifylogospin.gif' } },
      { id: 'appleMusic', label: 'Apple Music', hero: { kind: 'image', src: 'gifs/Applemusiclogospin.gif' } },
      { id: 'bandcamp',   label: 'Bandcamp',    hero: { kind: 'image', src: 'gifs/bandcamplogospin.gif' } },
      { id: 'soundcloud', label: 'SoundCloud',  hero: { kind: 'image', src: 'gifs/soundcloudlogospin.gif' } }
    ]
  },
  { id: 'games',  label: 'Games',
    items: [{ id: 'asymptote', label: 'Asymptote Engine', hero: { kind: 'text', text: 'Asymptote Engine' } }]
  }
  // About section temporarily hidden
];
```

### Core state variables

```js
let currentSectionIdx = 0, currentItemIdx = 0;
let isTransitioning = false, isPulling = false;
let queuedTarget = null, activeTarget = null;
let homeSectionLocked = false;

// Hero surface caching (background RAF capture for text heroes)
let currentHeroSurface = null;
let currentHeroSurfaceKey = null;
let currentHeroSurfaceFrameId = null;
let currentHeroSurfaceTrackingKey = null;

// GIF playback via gifler
let activeGifPlayback = null;
let giflerLoaderPromise = null;
let preparedToGifCanvas = null, preparedToGifKey = null;

// Slingshot pull state
let pullTargetSectionIdx = null, pullTargetItemIdx = null;
let pullFromSurface = null, pullToSurface = null;
let pullFromSurfacePromise = null, pullToSurfacePromise = null;
let pullPreviewParticlesBase = null, pullPreviewParticles = null;
let pullPreviewCanvasW = 0, pullPreviewCanvasH = 0;

// Game mode slingshot coordinates
let gameModePullSecIdx = null, gameModePullItemIdx = null;

const DESKTOP_CHAIN_WINDOW_MS = 260;
const REVEAL_HANDOFF_FADE_MS = 70;
let lastDesktopNavInputAt = 0;
```

### External window APIs

```js
let isAsymptoteGameActive = false;
window.__SPA_SetGameMode = (active) => { isAsymptoteGameActive = !!active; };
window.__SPA_GoHome = () => goTo(0, 0);
window.__SPA_ExitGameToCurrentItem = () => { void exitGameToCurrentItem(); };
window.__SPA_EnterCurrentGame = () => { void enterCurrentGameWithTransition(); };
window.__SPA_RestoreCurrentItemHero = () => {
  renderHeroDOM(currentSectionIdx, currentItemIdx);
  startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);
};
window.__SPA_CloseCurrentOverlayWithTransition = () => { void closeOverlayWithTransition(); };
window.__SPA_CancelSlingshot = () => { cancelSlingshot(); };
```

### Helper: `addActivationHandler(element, handler)`

Fires on `touchend` (immediate, calls `preventDefault()`) and `onclick` (mouse / a11y fallback). Prevents double-fire on touch.

### Hero spec resolution

`getHeroSpec(sectionIdx, itemIdx)`:
- `kind: 'image'` with `src` → `{ kind: 'image', src }`.
- `kind: 'text'` with `text` → `{ kind: 'text', text }`.
- Fallback → `{ kind: 'text', text: item.label }`.

### URL safety

`getSafeExternalUrl(action)`: `new URL(action, window.location.origin)`, return `href` only for `https:` protocol. Any other protocol or parse failure → `null`.

### Navigation targets

`getNextTarget(sectionIdx, itemIdx)`:
- Next item in same section if available.
- Else next section (wrapping), `itemIdx: 0`.
- Sections filtered by `homeSectionLocked` (skip index 0 when locked).

`getPrevTarget`: mirror — previous item, else previous section last item.

### GIF playback system

**`loadGifler()`** → Promise: lazily injects `<script src="js/vendor/gifler.min.js">`. Caches promise. Rejects if `window.gifler` not a function after load.

**`startGifHeroPlayback({ canvas, src, width=320, height=320, playbackKey })`**:
- Stops any active playback.
- `loadGifler().then(gifler => gifler(src).animate(canvas, frameCallback))`.
- Frame callback: scale-to-fit centered, set `hasPaintedFrame = true`.
- Fallback if gifler fails: `new Image()` draw centered to canvas (no animation).
- Returns `{ stop() }`.

**`stopActiveGifHeroPlayback()`**: calls `activeGifPlayback.stop()` if set.

**`prepareToGifCanvas(sectionIdx, itemIdx, src, width=320, height=320)`**:
- Returns cached canvas if key matches.
- Creates canvas, starts playback with key `prepared:${sectionIdx}:${itemIdx}`.
- Stores in `preparedToGifCanvas/preparedToGifKey`.

### Hero DOM rendering

`renderHeroDOM(sectionIdx, itemIdx, options = {})`:

1. Stop active GIF playback (unless `options.preserveActiveGifPlayback`).
2. Clear `heroContainer.innerHTML`.
3. If `window.__SPA_Views?.[sectionId]?.mount` exists → delegate and return.
4. Create `.spa-hero` div. Set `draggable="false"`, prevent dragstart.
5. If item has `clickAction` (external or overlay): add `spa-hero--linkable`, role=link, tabindex=0, keydown handler for Enter/Space.
6. If `heroSpec.kind === 'image'`:
   - If GIF (`.gif` in src): use `options.preparedGifCanvas` or create new canvas. `spa-hero-gif spa-hero-gif-canvas`, `pointerEvents: none`, 320×320. Apply warmup surface if provided. Start playback with key `${sectionIdx}:${itemIdx}`.
   - Else: `<img>` with `spa-hero-image`, 320×320, `draggable: false`.
7. Else (text): add `spa-hero--text`, create `.spa-hero-text` div with textContent.
8. Append hero to `heroContainer`.

### Navigation rendering

**`updateSectionNav(sectionIdx)`**: creates/reuses `#spa-section-nav`. Renders one `.spa-nav-btn` per section (skip home when `homeSectionLocked`). Active section gets `fontWeight: bold`, `background: #333`, `aria-current: "page"`.

**`updateItemDots(sectionIdx, itemIdx)`**: renders `.spa-dot` buttons (one per item). Skip render if ≤ 1 item. Active gets `aria-selected="true"`.

**`render()`**: calls both update functions then `renderHeroDOM`.

**`setupItemNav()`**: creates prev/next buttons in `#spa-item-nav` if not present. Attaches `addActivationHandler`.

### Transition canvas alignment

**`alignTransitionCanvas(transitionCanvas, fromSurface, toSurface)`**:

```
STAGE_PADDING_PX = 72
stageWidth  = max(from.width,  to.width)  + STAGE_PADDING_PX * 2
stageHeight = max(from.height, to.height) + STAGE_PADDING_PX * 2
transitionCanvas.width  = stageWidth
transitionCanvas.height = stageHeight
```

Position canvas centered on hero or heroContainer within `#spa-root` using `getBoundingClientRect()` differences. Set `style.left` and `style.top` (canvas uses `transform: translate(-50%, -50%)`).

### `runHeroTransition(fromSurface, toSurface, transitionOptions)`

1. `alignTransitionCanvas`.
2. Hide hero: `visibility: hidden; opacity: 0; transition: ''`.
3. Show canvas: `display: block; opacity: 1; transition: ''`.
4. `await transition(fromCanvas, toCanvas, { ctx, fromRegion, toRegion, ...engineOptions })` wrapped in a Promise.
5. In finally:
   - Call `onBeforeReveal()` if provided (await).
   - Restore hero: `visibility: visible; transition: opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-out`.
   - Canvas: `transition: opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-in`.
   - `await rAF`, then set `heroOpacity=1`, `canvasOpacity=0`.
   - `await setTimeout(REVEAL_HANDOFF_FADE_MS)`.
   - Hide canvas: `display: none; opacity: 1; transition: ''`. Clear hero transition.

### Hero surface caching system

**`getHeroSurfaceKey(si, ii)`** → `"${si}:${ii}"`.

**`isGifHeroSpec(hero)`** → true if `hero.kind === 'image'` and src matches `/\.gif(?:[?#]|$)/i`.

**`isProceduralCanvasHero(si, ii)`** → true if `window.__SPA_Views?.[sectionId]?.buildHeroProbe` exists AND `heroContainer.querySelector('canvas')` is non-null.

**`findHeroSeedCanvas(heroContainer)`**: prefers `.spa-hero-gif-canvas`, then `.spa-hero canvas`.

**`startCurrentHeroSurfaceTracking(si, ii)`**:
- Stops previous tracking.
- For text + non-procedural: `refreshCurrentHeroSurface` once, then RAF loop that refreshes while not transitioning and target matches.
- For GIF or procedural canvas: skip tracking (`currentHeroSurface = null`).

**`stopCurrentHeroSurfaceTracking()`**: cancel RAF, clear tracking key.

**`refreshCurrentHeroSurface(si, ii)`**: calls `rasterizeHero(buildHeroRenderInput(si, ii, 'from'))`, stores result in `currentHeroSurface/Key`.

### Hero surface building

**`buildHeroRenderInput(si, ii, phase)`**:
- `phase='from'`: prefer live inline overlay el, then live `.spa-hero`, then `window.__SPA_Views[sectionId]?.buildHeroProbe(itemId, container)`, then `createTextProbe(text)`.
- `phase='from'` image: prefer `.spa-hero-gif-canvas` canvas, then `.spa-hero-image` img.
- Fallback for image: `{ type: 'gif', src: hero.src }`.

**`buildHeroSurface(si, ii, phase)`**:
- `phase='from'` and key matches and not GIF/procedural and cache valid → return `currentHeroSurface`.
- Otherwise: `rasterizeWithCleanup(buildHeroRenderInput(...))`.
- For element-type from with gif fallback: race element capture against src rasterization.

### `goTo(nextSi, nextIi, navOptions = {})`

Guard: `homeSectionLocked && nextSi === 0 && currentSi !== 0` → return.
Guard: same target → return.
Guard: already transitioning → queue target (replacing any existing queue).

Flow:
1. `isTransitioning = true`, `activeTarget = { ...requestedTarget, transitionOptions }`.
2. Stop GIF playback, stop surface tracking.
3. Invalidate pull state (from/to surfaces and promises).
4. Call `onDeactivate` on outgoing view (swallow errors).
5. `prepareToGifCanvas` for target if GIF.
6. `await Promise.all([buildHeroSurface(from,'from'), buildHeroSurface(to,'to')])`.
7. `await runHeroTransition(from, to, { ...transitionOptions, onBeforeReveal: async () => { ... } })`.
8. Inside `onBeforeReveal`: `closeOverlayForNavigation()`, optionally set `homeSectionLocked`, `renderHeroDOM` with prepared GIF canvas, `updateSectionNav/Dots`, set `didRenderDuringReveal = true`.
9. Commit: `currentSectionIdx = next; currentItemIdx = next`.
10. Call `onActivate` on incoming view.
11. If not `didRenderDuringReveal`: `render()`.
12. In finally: `isTransitioning = false`, `startTracking`, process `queuedTarget`.

### Pull preview system

**Constants:**
```
SLINGSHOT_PARTICLE_SIZE = 4
SLINGSHOT_MIN_RELEASE   = 0.15
STRETCH_MAX = 55  (px at pullNormalized=1)
TRAIL_BIAS  = 0.55
```

**`samplePullParticles(surface, canvasW, canvasH)`**: draw surface centered on offscreen canvas, read pixels, collect `{ x, y, cx, cy, color, frayX, frayY }` (cx/cy = offset from canvas center; frayX/Y = stable per-particle random direction in ±1 range).

**`renderPullPreview(pullVector, pullNormalized)`**:
- Phase A (< 0.25): draw `pullFromSurface` centered. `pullPreviewParticles = null`. Return.
- Phase B entry (0.25, first time): sample particles into `pullPreviewParticlesBase`.
- Phase B (0.25–0.65): hero alpha fades (1 - phaseB), particles fade in.
- Phase C (0.65–1.0): fully particle.
- Particle displacement: `proj = (p.cx * pullNx + p.cy * pullNy) / (maxRadius * 0.5)`. Asymmetric scale: `proj >= 0 ? 0.4 : 1.2`. `stretchAmt = proj * pullNormalized * STRETCH_MAX * asymScale`. Fray direction biased toward trailing: `(-pullNx) * TRAIL_BIAS + p.frayX * (1 - TRAIL_BIAS)`.

### Slingshot callbacks

**`onSlingshotLock({ direction, pullVector, pullNormalized })`**:
- If already transitioning/pulling and not in game: queue target, return `false`.
- Start `isPulling=true, isTransitioning=true`.
- Kick off `assignPullFromPromise` and `assignPullToPromise` in parallel.
- Seed transition canvas with live canvas frame if `pullFromSurface` not yet available.
- Hide hero DOM, show transition canvas.
- Call `renderPullPreview`.

**`onSlingshotPull`**: call `renderPullPreview`.

**`onSlingshotRelease({ pullNormalized })`**:
- If `pullNormalized < SLINGSHOT_MIN_RELEASE` → `cancelSlingshot()`, call `runWeakPullTapFallbackIfNeeded()` (fires overlay action if applicable).
- Await `Promise.all([pullFromSurfacePromise, pullToSurfacePromise])`.
- `alignTransitionCanvas` with resolved surfaces.
- If `pullPreviewParticles` available: remap particles to new canvas coordinates (shiftX/Y from old vs new canvas size), call `transitionFromPull(remapped, toSurface, ctx, { fromParticlesBase: remappedBase }, resolve)`.
- Else: fall back to `transition(from, to, ...)`.
- Reveal sequence (same as `runHeroTransition` finally block).
- Commit state: `currentSectionIdx/ItemIdx`, activate incoming view.
- `cleanupSlingshotPull()`, start surface tracking.
- Process `queuedTarget`.

**`cancelSlingshot()`**: hide canvas, show hero, restore DOM, cleanup pull state, restart surface tracking, re-activate current view.

**`cleanupSlingshotPull()`**: reset all pull state variables (isPulling, isTransitioning, activeTarget, queuedTarget, all pull coords/surfaces/promises/particles/gameModeCoords).

### Promise binding helpers

**`assignPullFromPromise(p)`**: binds to `pullFromSurfacePromise`; `.then` sets `pullFromSurface` only if promise hasn't been superseded.

**`assignPullToPromise(p)`**: same for `pullToSurface`.

### Keyboard navigation

```js
window.addEventListener('keydown', (e) => {
  const isPrev = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
  const isNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';
  if (!isPrev && !isNext) return;
  // In game mode: prevent default, route to gameNavigateWithTransition
  // Normal: call prevItem / nextItem with desktop nav options
});
```

**`getDesktopNavOptions()`**: compares `performance.now()` against `lastDesktopNavInputAt` with `DESKTOP_CHAIN_WINDOW_MS = 260`. Returns `timingProfile: 'releaseLike'` or `timingProfile: 'releaseLikeChained'`.

### Game mode integration (stubs required)

These functions are required and must exist but their internal game-specific logic depends on `window.__SPA_GameNav` and `window.__SPA_Views.games`:

- `enterCurrentGameWithTransition()`: transition from current hero to game probe via `runHeroTransition`.
- `exitGameToCurrentItem()`: transition back from game to current entry hero.
- `gameNavigateWithTransition(direction, navOptions)`: in-game navigation with full particle transition using `window.__SPA_GameNav.buildHeroProbe / getFromTarget / getToTarget / commitTo`.

### Overlay integration (stubs required)

- `openOverlayWithTransition(action)`: build probe from `window.__SPA_Overlay.buildProbe`, transition, then `openInline`.
- `closeOverlayWithTransition()`: capture current hero, transition, then `window.__SPA_Overlay.close({ restore: false })`.
- `closeOverlayForNavigation()`: instant close, no transition.

### Boot sequence

```js
setupItemNav();
render();
// Activate initial view
const sectionId = SPA_SECTIONS[0]?.id;
const itemId = SPA_SECTIONS[0]?.items[0]?.id;
if (sectionId && itemId) {
  try { window.__SPA_Views?.[sectionId]?.onActivate?.(itemId); } catch (_) {}
}
startCurrentHeroSurfaceTracking(0, 0);
initSlingshot(document.getElementById('spa-hero-container'), {
  onArm: onSlingshotArm,
  onTap: onSlingshotTap,
  onLock: onSlingshotLock,
  onPull: onSlingshotPull,
  onRelease: onSlingshotRelease,
  onCancel: onSlingshotCancel
});
```

---

## js/spa/routes.js  — classic `<script>` global

Sets `window.__INDROLEND_ROUTES__` with shape:
```js
window.__INDROLEND_ROUTES__ = {
  items: {
    'social/tiktok':    { clickAction: 'https://tiktok.com/@indrolend' },
    'social/instagram': { clickAction: 'https://instagram.com/indrolend' },
    // ... etc for all social / music / games items
    'music/soundcloud': { clickAction: 'overlay:soundcloud' }  // example overlay action
  }
};
```

`clickAction` values are either `https://` URLs or `overlay:{id}` strings.

---

## js/spa/overlayManager.js  — classic `<script>` global

Sets `window.__SPA_Overlay` with interface:
```
isOpen()           → boolean
open(id, data)
openInline(id, data, containerEl)
close(options)     — options.restore: boolean
buildProbe(id, data, options)  → { element, cleanup } | null
shouldSuppressTap()  → boolean
```

---

## External view/app system

`window.__SPA_Views` is a registry keyed by section id:
```
{
  [sectionId]: {
    mount(itemId, containerEl): void,
    onActivate(itemId): void,
    onDeactivate(itemId): void,
    buildHeroProbe(itemId, containerEl): { element, cleanup } | null
  }
}
```

`window.__SPA_GameNav` (set by games view):
```
{
  getFromTarget()                           → { sectionIdx, itemIdx }
  getToTarget(direction)                    → { sectionIdx, itemIdx }
  commitTo(sectionIdx, itemIdx)             → void
  buildHeroProbe(sectionIdx, itemIdx)       → { element, cleanup } | null
  onTap()                                   → void
}
```

---

## Behavioral invariants

1. `isTransitioning` and `isPulling` are mutual guards — no transition starts while either is true.
2. At most one `queuedTarget` at a time; new navigation requests while busy replace the queue.
3. GIF heroes never use cached `currentHeroSurface`; always captured live at transition start.
4. Procedural canvas heroes (game engine) never use cached surface; always captured live.
5. Pull preview particle positions are stored canvas-local. On release, they are remapped by `(newCW - oldCW) / 2` shift before being passed to `transitionFromPull`.
6. `REVEAL_HANDOFF_FADE_MS = 70` is used for both hero fade-in and canvas fade-out simultaneously (cross-fade).
7. `homeSectionLocked` is set on first navigation away from home (index 0), never unset.
8. All external link opens use `window.open(url, '_blank', 'noopener,noreferrer')` with `newWindow.opener = null`.
9. slingshot tap fires overlay/link action for the current item; does nothing if overlay is open.
10. Keyboard arrow keys use a chained timing window (`DESKTOP_CHAIN_WINDOW_MS = 260ms`) to select `timingProfile: 'releaseLikeChained'` for rapid key-repeat navigation.
