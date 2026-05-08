// particleSampler.js — shared particle sampling helpers
//
// Used by particlePlans.js (explode-reform, pull-reform) and
// transitionKernel.js (slingshot pull-preview sampling).

export const PARTICLE_SIZE = 4;

/** Reused scratch canvas; sequential sampleParticles calls are safe. */
let _scratchCanvas = null;

/**
 * Sample visible pixels from a hero surface into an array of {x, y, color} particles.
 * Pixels are sampled every PARTICLE_SIZE in both dimensions.
 * @param {{ canvas: HTMLCanvasElement, width: number, height: number }} region
 * @param {number} canvasWidth  — target canvas coordinate space
 * @param {number} canvasHeight
 * @returns {Array<{x: number, y: number, color: string}>}
 */
export function sampleParticles(region, canvasWidth, canvasHeight) {
  if (!_scratchCanvas) _scratchCanvas = document.createElement('canvas');
  const c = _scratchCanvas;
  if (c.width !== canvasWidth || c.height !== canvasHeight) {
    c.width  = canvasWidth;
    c.height = canvasHeight;
  }
  const cctx = c.getContext('2d');
  const dx = (canvasWidth  - region.width)  / 2;
  const dy = (canvasHeight - region.height) / 2;
  cctx.clearRect(0, 0, canvasWidth, canvasHeight);
  cctx.drawImage(region.canvas, 0, 0, region.width, region.height, dx, dy, region.width, region.height);

  // Only read back the region that was drawn — avoids getImageData on transparent edges.
  // Use floor for the start and ceil for the end so sub-pixel offsets never clip edge pixels.
  const scanX = Math.max(0, Math.floor(dx));
  const scanY = Math.max(0, Math.floor(dy));
  const scanW = Math.min(canvasWidth  - scanX, Math.ceil(dx + region.width)  - scanX);
  const scanH = Math.min(canvasHeight - scanY, Math.ceil(dy + region.height) - scanY);
  if (scanW <= 0 || scanH <= 0) return [];

  const imgData = cctx.getImageData(scanX, scanY, scanW, scanH).data;
  const result  = [];
  for (let row = 0; row < scanH; row += PARTICLE_SIZE) {
    for (let col = 0; col < scanW; col += PARTICLE_SIZE) {
      const idx = (row * scanW + col) * 4;
      const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
      if (a > 32) result.push({ x: scanX + col, y: scanY + row, color: `rgba(${r},${g},${b},${a / 255})` });
    }
  }
  return result;
}

/**
 * Sub-sample `list` down to exactly `count` entries using even coverage spacing.
 */
export function sampleByCoverage(list, count) {
  if (!list.length || count <= 0) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(list[Math.floor((i * list.length) / count) % list.length]);
  }
  return out;
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Parse `rgba(r,g,b,a)` → [r, g, b, a]. */
export function parseRgba(color) {
  const m = /rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/.exec(color);
  return m ? [+m[1], +m[2], +m[3], +m[4]] : [255, 255, 255, 1];
}
