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
    spaData.js                  ← ES module
    utils.js                    ← ES module
    navModel.js                 ← ES module
    renderNav.js                ← ES module
    renderHero.js               ← ES module
    rasterizeHero.js            ← ES module
    surfaceManager.js           ← ES module
    particleSampler.js          ← ES module
    particlePlans.js            ← ES module
    particleEngine.js           ← ES module
    transitionKernel.js         ← ES module
    slingshotGesture.js         ← ES module
    appKernel.js                ← ES module
    routes.js                   ← classic <script> global
    overlayManager.js           ← classic <script> global
    apps/
      asymptoteApp.js           ← classic <script> global
    views/
      gamesView.js              ← classic <script> global
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

## js/spa/spaData.js  — ES module

Exports SPA section/item data, shared constants, and pure data accessors.

### SPA_SECTIONS

```js
export const SPA_SECTIONS = [
  {
    id: 'home', label: 'Home',
    items: [
      { id: 'orb', label: 'Indrolend', hero: { kind: 'text', text: 'INDROLEND' }, swipe: true }
    ]
  },
  {
    id: 'social', label: 'Social',
    items: [
      { id: 'tiktok',    label: 'TikTok',    hero: { kind: 'image', src: 'gifs/Tiktoklogospin.gif' } },
      { id: 'instagram', label: 'Instagram', hero: { kind: 'image', src: 'gifs/Instagramlogospin.gif' } },
      { id: 'youtube',   label: 'YouTube',   hero: { kind: 'image', src: 'gifs/Youtubelogospin.gif' } }
    ]
  },
  {
    id: 'music', label: 'Music',
    items: [
      { id: 'spotify',    label: 'Spotify',     hero: { kind: 'image', src: 'gifs/Spotifylogospin.gif' } },
      { id: 'appleMusic', label: 'Apple Music', hero: { kind: 'image', src: 'gifs/Applemusiclogospin.gif' } },
      { id: 'bandcamp',   label: 'Bandcamp',    hero: { kind: 'image', src: 'gifs/bandcamplogospin.gif' } },
      { id: 'soundcloud', label: 'SoundCloud',  hero: { kind: 'image', src: 'gifs/soundcloudlogospin.gif' } }
    ]
  },
  {
    id: 'games', label: 'Games',
    items: [
      { id: 'asymptote', label: 'Asymptote Engine', hero: { kind: 'text', text: 'Asymptote Engine' } }
    ]
  }
];
```

### Constants

```js
export const STAGE_PADDING_PX        = 72;
export const SLINGSHOT_MIN_RELEASE   = 0.15;
export const REVEAL_HANDOFF_FADE_MS  = 70;
export const DESKTOP_CHAIN_WINDOW_MS = 260;
export const STRETCH_MAX             = 55;
export const TRAIL_BIAS              = 0.55;
export const SLINGSHOT_PARTICLE_SIZE = 4;
```

### Pure data accessors

```js
export function getSection(si)            // SPA_SECTIONS[si] ?? null
export function getItem(si, ii)           // SPA_SECTIONS[si]?.items[ii] ?? null
export function getHeroSpec(si, ii)       // item?.hero ?? { kind: 'text', text: '' }
export function getHeroSurfaceKey(si, ii) // `${si}:${ii}`
export function isGifHero(si, ii)         // kind==='image' && /\.gif(?:[?#]|$)/i.test(src)
export function getClickAction(si, ii)    // window.__INDROLEND_ROUTES__?.items?.[`${section.id}/${item.id}`]?.clickAction ?? null
```

---

## js/spa/utils.js  — ES module

```js
export function addActivationHandler(element, handler)
export function waitRaf()
export function waitMs(ms)
export function getSafeExternalUrl(href)
```

`addActivationHandler`: fires `handler` on `touchend` (calls `e.preventDefault()`) and `onclick` (mouse/a11y fallback). Prevents double-fire on touch via a 600 ms guard flag.

`waitRaf()`: `Promise<void>` that resolves on the next `requestAnimationFrame`.

`waitMs(ms)`: `Promise<void>` that resolves after `ms` milliseconds via `setTimeout`.

`getSafeExternalUrl(href)`: `new URL(href, window.location.origin)`, returns `href` only for `https:` protocol. Any other protocol or parse failure → `null`.

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
4. Wrap in `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">…</div></foreignObject></svg>`.
5. Set as `img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)`.
6. On `img.onload`: draw centered, then `compositeCanvasChildren` with `destination-over` to composite live canvases behind the text.

### `cropToContent(canvas, padding = 0)`

Scan ImageData, find opaque bbox (alpha > 32), add padding, return cropped canvas with `offsetX/Y/width/height`. If no opaque pixels, return original with `hasVisibleContent: false`.

### Canvas sizing

- `textElement`: use `getBoundingClientRect()`, add `TEXT_RASTER_CANVAS_PADDING * 2` each axis, floor to at least `HERO_CANVAS_WIDTH / HERO_CANVAS_HEIGHT`.
- `text` fallback: measure text with canvas ctx, width = measured + padding * 2, height = `HERO_CANVAS_HEIGHT`.

---

## js/spa/particleSampler.js  — ES module

Shared particle sampling helpers used by `particlePlans.js` and `transitionKernel.js`.

**Exports:**

```js
export const PARTICLE_SIZE = 4;
export function sampleParticles(region, canvasWidth, canvasHeight)
export function sampleByCoverage(list, count)
export function shuffle(list)
export function parseRgba(color)
```

`sampleParticles(region, canvasWidth, canvasHeight)`:
- Reuses a single module-level scratch canvas (lazily created).
- Draws `region.canvas` centered on the scratch canvas.
- Reads ImageData; collects `{ x, y, color: 'rgba(r,g,b,a)' }` for every `PARTICLE_SIZE` grid cell with alpha > 32.
- Returns array.

`sampleByCoverage(list, count)`: evenly spaced indices, returns exactly `count` entries.

`shuffle(arr)`: Fisher-Yates, returns a new array.

`parseRgba(color)`: parses `rgba(r,g,b,a)` → `[r, g, b, a]`.

---

## js/spa/particlePlans.js  — ES module

Imports from `particleSampler.js`. Builds particle plans for use with `particleEngine.runParticleAnimation`.

**Exports:**
- `buildExplodeReformPlan(fromRegion, toRegion, canvasWidth, canvasHeight, timingProfile)`
- `buildPullReformPlan(pulledParticles, toRegion, canvasWidth, canvasHeight, fromParticlesBase)`

A **plan** is `{ particles: Array, phases: Array<{ duration: ms, tick(elapsed, particles, ctx) }> }`.

### `buildExplodeReformPlan`

```
timingProfile: 'default' | 'chained'
EXPLODE_DURATION: chained=80ms,  default=120ms
REFORM_DURATION:  chained=160ms, default=230ms
EXPLODE_RADIUS = min(canvasWidth, canvasHeight) * (chained ? 0.34 : 0.4)
PARTICLE_COUNT = floor((max(fromW, toW) * max(fromH, toH)) / PARTICLE_SIZE²)
```

Each particle: `{ x0, y0, c0, x1, y1, c1, ex, ey }`.
- `ex/ey` = start + random angle * radius (between 30%–100% of EXPLODE_RADIUS).
- Phase 1 (EXPLODE_DURATION): linear `x0→ex`, `y0→ey`, constant `c0` color.
- Phase 2 (REFORM_DURATION): `easeOutBack` `ex→x1`, `ey→y1`, color lerped `c0→c1`.

`easeOutBack(t)`: `const s = 1.1; const u = t-1; return 1 + (s+1)*u*u*u + s*u*u`.

### `buildPullReformPlan`

```
SNAP_DURATION   =  80ms  (pull positions → rest, ease-out-quad)
REFORM_DURATION = 270ms  (rest → target, easeOutBack, color lerp)
```

N = max(pulledParticles.length, rawToParticles.length).
Snap phase only present when `fromParticlesBase` is provided and non-empty.
Phase 2: `pt.xm → pt.x1` via `easeOutBack`.
Returns `null` if `pulledParticles` is empty/null or `toRegion` yields no particles.

---

## js/spa/particleEngine.js  — ES module

**Export:** `export function runParticleAnimation(ctx, plan, onComplete)`

Runs a plan built by `particlePlans.js` against a 2D canvas context.

- Each phase's `tick(elapsedSincePhaseStart, particles, ctx)` draws one frame.
- Engine calls `ctx.clearRect` before each tick.
- Calls `onComplete` when total duration is exhausted or if `ctx.canvas.isConnected` is false.
- Uses `requestAnimationFrame` loop; first frame sets `startTime`.
- If `particles` is empty or `phases` is empty → call `onComplete` immediately.

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

## js/spa/navModel.js  — ES module

Navigation target computation and desktop timing tracker.

**Exports:**

```js
export function getAvailableSections(homeSectionLocked)
export function getNextTarget(si, ii, homeSectionLocked)
export function getPrevTarget(si, ii, homeSectionLocked)
export function getTargetForDirection(direction, si, ii, homeSectionLocked)
export function createDesktopNavTracker()
```

`getNextTarget`: next item in same section if available, else next section (wrapping), `itemIdx: 0`. Home section (index 0) is excluded when `homeSectionLocked`.

`getPrevTarget`: previous item in same section if available, else previous section last item. Home excluded when locked.

`getTargetForDirection(direction, ...)`: calls `getNextTarget` for `'next'`, `getPrevTarget` for `'prev'`.

`createDesktopNavTracker()` → `{ getNavOptions() }`: `getNavOptions()` compares `performance.now()` against `lastInputAt` using `DESKTOP_CHAIN_WINDOW_MS`. Returns `{ timingProfile: 'chained' }` if within window, else `{ timingProfile: 'default' }`. Updates `lastInputAt` on every call.

---

## js/spa/renderNav.js  — ES module

**Export:** `createNavRenderer({ dotsContainer, onNav })` → `{ updateSectionNav, updateItemDots, setupItemNav }`

`updateSectionNav(si, homeSectionLocked)`:
- Creates `<nav id="spa-section-nav" aria-label="Sections">` if not present; inserts as `document.body.firstChild`.
- Clears and re-renders one `.spa-nav-btn` button per visible section (home excluded when locked).
- Active section gets `fontWeight: bold`, `background: '#333'`, `aria-current: 'page'`.
- Click/touch via `addActivationHandler` → `onNav(sectionIdx, 0)`.

`updateItemDots(si, ii)`:
- Clears `dotsContainer`. If section has ≤ 1 item: nothing rendered.
- Otherwise renders `.spa-dot` buttons (role=tab, aria-label=item.label, `aria-selected` on active).
- Click/touch → `onNav(si, idx)`.

`setupItemNav(prevBtn, nextBtn, onPrev, onNext)`:
- Attaches `addActivationHandler` to prevBtn and nextBtn.

---

## js/spa/renderHero.js  — ES module

**Export:** `createHeroRenderer({ heroContainer, onAction })` → `{ renderHeroDOM }`

`renderHeroDOM(si, ii)`:
1. Clears `heroContainer.innerHTML`.
2. Looks up section/item. If not found → return.
3. Delegates to `window.__SPA_Views?.[section.id]?.mount?.(item.id, heroContainer)` if the view module exists; returns immediately.
4. Creates `div.spa-hero` with `draggable="false"` and dragstart prevention.
5. If `clickAction` exists: add class `spa-hero--linkable`, `role="link"`, `tabindex="0"`, keydown handler (Enter/Space), and `addActivationHandler` → `onAction(clickAction)`.
6. If `heroSpec.kind === 'image'`: create `<img class="spa-hero-image">` with `src`, `width=320`, `height=320`, `objectFit: contain`, `draggable: false`. All image formats (including GIFs) are rendered as native `<img>` elements.
7. Else (text): add class `spa-hero--text`, create `div.spa-hero-text` with `textContent = heroSpec.text || item.label`.
8. Append hero div to `heroContainer`.

---

## js/spa/surfaceManager.js  — ES module

**Export:** `createSurfaceManager({ heroContainer, rasterizeHero, getIsTransitioning })` → `{ startTracking, stopTracking, buildSurface }`

Owns the live hero surface cache (one surface at a time).

`startTracking(si, ii)`:
- Stop any existing tracking RAF.
- If `isGifHero(si, ii)` or the section's view module has `buildHeroProbe`: clear cache, skip tracking.
- Otherwise: launch RAF loop that calls `buildSurface(si, ii, 'from')` each frame while `!getIsTransitioning()`, stores result as `_currentSurface`.

`stopTracking()`: cancel RAF, null out tracking key.

`buildSurface(si, ii, phase)` → `Promise<surface | null>`:
- For `phase === 'from'` with matching key and non-GIF: return cached `_currentSurface` immediately.
- Calls `_buildRenderInput(si, ii, phase)` then `rasterizeHero(input)`. Calls `input.cleanup()` if provided.

`_buildRenderInput` for `phase='from'`:
1. Live `.spa-hero-image` img → `{ type: 'element', element: img }`.
2. Live `.spa-hero` element → `{ type: 'textElement', element }`.
3. Visible `.spa-overlay--inline` inside `#spa-overlay-root` → `{ type: 'textElement', element }`.
4. View `buildHeroProbe` result → `{ type: 'textElement', element, cleanup }`.
5. Image hero fallback → `{ type: 'gif', src }`.
6. Text hero fallback → `{ type: 'text', text }`.

`_buildRenderInput` for `phase='to'`:
1. Image hero → `{ type: 'gif', src }`.
2. View `buildHeroProbe` result → `{ type: 'textElement', element, cleanup }`.
3. Text hero fallback → `{ type: 'text', text }`.

---

## js/spa/transitionKernel.js  — ES module

**Export:** `createTransitionKernel({ transitionCanvas, transitionCtx, heroContainer })` → `{ alignCanvas, showCanvas, hideCanvas, hideHero, runTransition, resetPullPreview, renderPullPreview, runSlingshotRelease }`

Owns canvas alignment, DOM show/hide, particle animation, pull-preview, and reveal handoff.

### Canvas helpers

`alignCanvas(fromSurface, toSurface)`:
- `stageW = max(from?.width ?? 0, to?.width ?? 0) + STAGE_PADDING_PX * 2`, minimum 64.
- `stageH` similarly.
- Position canvas centered on `heroContainer` relative to `#spa-root` via `getBoundingClientRect()`. Set `style.left`, `style.top` (canvas uses CSS `transform: translate(-50%, -50%)`).

`showCanvas()`: `display: block; opacity: 1; transition: ''`.
`hideCanvas()`: `display: none; opacity: 1; transition: ''`.
`hideHero()`: set `heroContainer.firstElementChild` to `visibility: hidden; opacity: 0; transition: ''`.

### Reveal handoff (`_revealHandoff(onBeforeReveal)`)

1. `await onBeforeReveal()` if provided.
2. Set hero `visibility: visible; transition: opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-out`.
3. Set canvas `transition: opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-in`.
4. `await waitRaf()`, then set hero `opacity: 1`, canvas `opacity: 0`.
5. `await waitMs(REVEAL_HANDOFF_FADE_MS)`.
6. `hideCanvas()`, clear hero transition.

### `runTransition(fromSurface, toSurface, opts = {})`

If either surface is null/missing: skip animation, call `opts.onBeforeReveal()` and return.
1. `alignCanvas` → `hideHero` → `showCanvas`.
2. `buildExplodeReformPlan(fromSurface, toSurface, cw, ch, opts.timingProfile || 'default')`.
3. `await new Promise(resolve => runParticleAnimation(transitionCtx, plan, resolve))`.
4. In `finally`: `await _revealHandoff(opts.onBeforeReveal)`.

### Pull-preview

`resetPullPreview()`: clears `_pullParticlesBase`.

`renderPullPreview(pullVector, pullNormalized, pullFromSurface)` → `{ particles, canvasW, canvasH } | null`:
- If `pullFromSurface` null: return null.
- Phase A (< 0.25): draw surface centered, clear base, return null.
- Phase B/C (≥ 0.25): sample base once if not yet sampled.
  - `phaseB = min(1, (pullNormalized - 0.25) / 0.4)`
  - If `phaseB < 1`: draw surface with `globalAlpha = (1 - phaseB)`.
  - Draw particles with `globalAlpha = min(1, phaseB * 2)`.
  - Per-particle displacement: `proj = (p.cx * pnx + p.cy * pny) / (maxR * 0.5)`. `asymScale = proj >= 0 ? 0.4 : 1.2`. `stretch = proj * pullNormalized * STRETCH_MAX * asymScale`. Trail direction: `(-pnx) * TRAIL_BIAS + p.frayX * (1 - TRAIL_BIAS)`.
  - Returns `{ particles: drawnParticles, canvasW: cw, canvasH: ch }`.

Internal `_samplePullParticles(surface, cw, ch)` → array of `{ x, y, cx, cy, color, frayX, frayY }` (cx/cy = offset from canvas center; frayX/Y = stable per-particle random direction in ±1 range).

### `runSlingshotRelease({ pulledParticles, pulledCanvasW, pulledCanvasH, fromSurface, toSurface, onBeforeReveal })`

1. `alignCanvas(fromSurface, toSurface)`.
2. Remap pulled particles by `shiftX = (cw - pulledCanvasW) / 2`, `shiftY = (ch - pulledCanvasH) / 2`.
3. `buildPullReformPlan(remapped, toSurface, cw, ch, null)` → if null (no particles), fall back to `buildExplodeReformPlan(fromSurface, toSurface, cw, ch, 'default')`.
4. `await new Promise(resolve => runParticleAnimation(transitionCtx, plan, resolve))`.
5. `await _revealHandoff(onBeforeReveal)`.

---

## js/spa/appKernel.js  — ES module

**Export:** `createAppKernel({ surfaceManager, transitionKernel, heroRenderer, navRenderer, rasterizeHero, heroContainer, desktopNav })` → kernel object

Owns all application state, navigation lifecycle, and slingshot callbacks.

### State

```js
let _si = 0, _ii = 0;
let _phase = 'idle'; // 'idle' | 'transitioning' | 'pulling'
let _homeSectionLocked = false;
let _isGameActive      = false;
let _queuedTarget      = null;
// Pull state
let _pullTargetSi, _pullTargetIi;
let _pullFromSurface, _pullToSurface;
let _pullFromPromise,  _pullToPromise;
let _pullParticles, _pullCanvasW, _pullCanvasH;
```

### `goTo(nextSi, nextIi)`

Guards: `_homeSectionLocked && nextSi === 0 && _si !== 0` → return. Same target and not pulling → return. Phase non-idle → queue target, return.

Flow:
1. `_phase = 'transitioning'`, stop surface tracking.
2. Call `onDeactivate` on outgoing view (swallow errors).
3. `await Promise.all([buildSurface(from,'from'), buildSurface(to,'to')])`.
4. `await transitionKernel.runTransition(from, to, { onBeforeReveal })`.
   - `onBeforeReveal`: `_closeOverlayForNav()`, set `_homeSectionLocked = true` if moving away from home, `renderHeroDOM(nextSi, nextIi)`, `updateSectionNav`, `updateItemDots`.
5. In `finally`: commit `_si/_ii`, call `onActivate` on incoming view, `_render()` if reveal didn't already render, `_phase = 'idle'`, `startTracking`, drain queue.

### Overlay lifecycle

`openOverlayWithTransition(overlayId)`: build probe via `window.__SPA_Overlay.buildProbe(overlayId, {}, { inline: true })`, rasterize it, transition, then `overlay.openInline(overlayId, {}, heroContainer)`.

`closeOverlayWithTransition()`: capture current hero (from) and target hero (to), transition, then `overlay.close({ restore: false })` + `renderHeroDOM`.

`_closeOverlayForNav()`: instant `overlay.close({ restore: false })` if open.

### Game mode

`enterCurrentGameWithTransition()`: build probe via `window.__SPA_GameNav.buildHeroProbe`, rasterize, transition, then `window.__SPA_Views['games'].mount('asymptote', heroContainer)` + set `_isGameActive = true`.

`exitGameToCurrentItem()`: transition from game canvas back to current hero. Set `_isGameActive = false`.

`gameNavigate(direction)`: build from/to probes via `window.__SPA_GameNav`, rasterize both, transition, `commitTo`.

### Slingshot callbacks

**`onTap()`**: return if `__SPA_Overlay.shouldSuppressTap()`. If overlay open → `closeOverlayWithTransition()`. If game active → `__SPA_GameNav.onTap()`. Else → `_handleHeroAction(getClickAction(_si, _ii))`.

**`onLock({ direction })`**: if `_phase === 'transitioning'` → queue target, return `false`. If `_phase === 'pulling'` → return `false`. Compute target (game: `__SPA_GameNav.getToTarget(direction)`, normal: `getTargetForDirection`). Set `_phase = 'pulling'`, kick off `_pullFromPromise` and `_pullToPromise` in parallel (`.then` stores resolved surface). `resetPullPreview`, `alignCanvas({ width: 320, height: 320 }, { width: 320, height: 320 })`, `showCanvas`, `hideHero`. Return `true`.

**`onPull({ pullVector, pullNormalized })`**: if `_pullFromSurface` available re-align canvas, then call `transitionKernel.renderPullPreview`, store result particles/canvas size.

**`onRelease({ pullNormalized })`**: if < `SLINGSHOT_MIN_RELEASE` → `cancelSlingshot()`. Await both surface promises. `runSlingshotRelease`. Commit `_si/_ii`. If game active commit via `__SPA_GameNav.commitTo`. Call `onActivate`. `_cleanupPull`, `startTracking`, drain queue.

**`cancelSlingshot()`**: `hideCanvas`, restore hero element visibility, `_cleanupPull`, `startTracking`, re-activate current view.

**`_cleanupPull()`**: `_phase = 'idle'`, clear all pull state vars, `resetPullPreview`.

### `navigate(direction)`

Routes to `gameNavigate(direction)` if game active, else `getTargetForDirection` + `goTo`.

### Hero action: `_handleHeroAction(clickAction)`

- `overlay:{id}` → `openOverlayWithTransition(id)`.
- Otherwise → `getSafeExternalUrl(clickAction)` → `window.open(url, '_blank', 'noopener,noreferrer')` with `newWindow.opener = null`.

### Public API

```js
{
  goTo, navigate,
  onTap, onLock, onPull, onRelease, onCancel, cancelSlingshot,
  openOverlayWithTransition, closeOverlayWithTransition,
  enterCurrentGameWithTransition, exitGameToCurrentItem, gameNavigate,
  setGameActive(active),
  getSi(), getIi(), isTransitioning(),
  onHeroAction: _handleHeroAction,
  render: _render,
  restoreCurrentItemHero()
}
```

---

## main.js  — entry point (type="module")

Imports at top of file:
```js
import { rasterizeHero }          from './js/spa/rasterizeHero.js';
import { initSlingshot }          from './js/spa/slingshotGesture.js';
import { getSection, getItem }    from './js/spa/spaData.js';
import { createDesktopNavTracker } from './js/spa/navModel.js';
import { createNavRenderer }      from './js/spa/renderNav.js';
import { createHeroRenderer }     from './js/spa/renderHero.js';
import { createSurfaceManager }   from './js/spa/surfaceManager.js';
import { createTransitionKernel } from './js/spa/transitionKernel.js';
import { createAppKernel }        from './js/spa/appKernel.js';
```

### DOM references

```js
const heroContainer    = document.getElementById('spa-hero-container');
const transitionCanvas = document.getElementById('transition-canvas');
const transitionCtx    = transitionCanvas.getContext('2d');
const dotsContainer    = document.getElementById('spa-dots');
```

### Module wiring

```js
const desktopNav = createDesktopNavTracker();

// Forward reference: heroRenderer needs kernel.onHeroAction, wired below.
let kernel;

const heroRenderer = createHeroRenderer({
  heroContainer,
  onAction: (action) => kernel.onHeroAction(action)
});

const navRenderer = createNavRenderer({
  dotsContainer,
  onNav: (si, ii) => kernel.goTo(si, ii)
});

const surfaceManager = createSurfaceManager({
  heroContainer,
  rasterizeHero,
  getIsTransitioning: () => kernel.isTransitioning()
});

const transitionKernel = createTransitionKernel({
  transitionCanvas, transitionCtx, heroContainer
});

kernel = createAppKernel({
  surfaceManager, transitionKernel, heroRenderer, navRenderer,
  rasterizeHero, heroContainer, desktopNav
});
```

### Window APIs

```js
window.__SPA_SetGameMode = (active) => kernel.setGameActive(active);
window.__SPA_GoHome      = () => kernel.goTo(0, 0);
window.__SPA_ExitGameToCurrentItem             = () => void kernel.exitGameToCurrentItem();
window.__SPA_EnterCurrentGame                  = () => void kernel.enterCurrentGameWithTransition();
window.__SPA_RestoreCurrentItemHero            = () => kernel.restoreCurrentItemHero();
window.__SPA_CloseCurrentOverlayWithTransition = () => void kernel.closeOverlayWithTransition();
window.__SPA_CancelSlingshot                   = () => kernel.cancelSlingshot();
```

### Keyboard navigation

```js
window.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const direction = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 'next' : 'prev';
  kernel.navigate(direction);
});
```

### Boot sequence

```js
navRenderer.setupItemNav(
  document.getElementById('spa-prev-btn'),
  document.getElementById('spa-next-btn'),
  () => kernel.navigate('prev'),
  () => kernel.navigate('next')
);

kernel.render();

const _initSection = getSection(0), _initItem = getItem(0, 0);
if (_initSection && _initItem) {
  try { window.__SPA_Views?.[_initSection.id]?.onActivate?.(_initItem.id); } catch (_) {}
}

surfaceManager.startTracking(0, 0);

initSlingshot(heroContainer, {
  onTap:     () => kernel.onTap(),
  onLock:    (e) => kernel.onLock(e),
  onPull:    (e) => kernel.onPull(e),
  onRelease: (e) => kernel.onRelease(e),
  onCancel:  () => kernel.onCancel()
});
```

---

## js/spa/routes.js  — classic `<script>` global

Sets `window.__INDROLEND_ROUTES__` with shape:
```js
window.__INDROLEND_ROUTES__ = {
  items: {
    'social/tiktok':    { clickAction: 'https://www.tiktok.com/@indrolend' },
    'social/instagram': { clickAction: 'https://www.instagram.com/indrolend' },
    'social/youtube':   { clickAction: 'https://www.youtube.com/@indrolend' },
    'music/spotify':    { clickAction: 'https://open.spotify.com/artist/indrolend' },
    'music/appleMusic': { clickAction: 'https://music.apple.com/us/artist/indrolend' },
    'music/bandcamp':   { clickAction: 'https://indrolend.bandcamp.com' },
    'music/soundcloud': { clickAction: 'overlay:soundcloud' },
    'games/asymptote':  { clickAction: 'overlay:asymptote' }
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

1. `_phase` is a three-state machine: `'idle'` | `'transitioning'` | `'pulling'`. No transition or pull starts while phase is non-idle.
2. At most one `_queuedTarget` at a time; new navigation requests while busy replace the queue.
3. GIF heroes (`.gif` src) never use cached `_currentSurface`; always captured live at transition start.
4. Procedural canvas heroes (game engine view with `buildHeroProbe`) never use cached surface; always captured live.
5. Pull preview particle positions are stored canvas-local. On release, they are remapped by `(newCW - oldCW) / 2` shift before being passed to `runSlingshotRelease`.
6. `REVEAL_HANDOFF_FADE_MS = 70` is used for both hero fade-in and canvas fade-out simultaneously (cross-fade).
7. `_homeSectionLocked` is set on first navigation away from home (index 0), never unset.
8. All external link opens use `window.open(url, '_blank', 'noopener,noreferrer')` with `newWindow.opener = null`.
9. Slingshot tap fires overlay/link action for the current item; does nothing if overlay suppresses taps.
10. Keyboard arrow keys use a chained timing window (`DESKTOP_CHAIN_WINDOW_MS = 260ms`) to select `timingProfile: 'chained'` for rapid key-repeat navigation.
