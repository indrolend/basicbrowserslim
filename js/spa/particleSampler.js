// particleSampler.js — shared particle sampling helpers
//
// Used by particlePlans.js (explode-reform, pull-reform) and
// transitionKernel.js (slingshot pull-preview sampling).

export const PARTICLE_SIZE    = 4;
export const FOCAL_LENGTH     = 300;
export const EXPLODE_Z_RANGE  = 220;
export const MIN_DEPTH_ALPHA  = 0.15; // minimum alpha for depth-faded particles
export const PULL_Z_RANGE     = 40;   // z-depth range for slingshot pull peel-off effect
const READBACK_DOWNSAMPLE     = 2;

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
  const sampleW = Math.max(1, Math.ceil(canvasWidth / READBACK_DOWNSAMPLE));
  const sampleH = Math.max(1, Math.ceil(canvasHeight / READBACK_DOWNSAMPLE));
  if (c.width !== sampleW || c.height !== sampleH) {
    c.width  = sampleW;
    c.height = sampleH;
  }
  const cctx = c.getContext('2d');
  const dx = (canvasWidth  - region.width)  / 2;
  const dy = (canvasHeight - region.height) / 2;
  cctx.clearRect(0, 0, sampleW, sampleH);
  cctx.drawImage(
    region.canvas,
    0, 0, region.width, region.height,
    dx / READBACK_DOWNSAMPLE,
    dy / READBACK_DOWNSAMPLE,
    region.width / READBACK_DOWNSAMPLE,
    region.height / READBACK_DOWNSAMPLE
  );
  const imgData = cctx.getImageData(0, 0, sampleW, sampleH).data;
  const result  = [];
  const sampleStride = Math.max(1, Math.floor(PARTICLE_SIZE / READBACK_DOWNSAMPLE));
  const scaleX = canvasWidth / sampleW;
  const scaleY = canvasHeight / sampleH;
  for (let y = 0; y < sampleH; y += sampleStride) {
    for (let x = 0; x < sampleW; x += sampleStride) {
      const idx = (y * sampleW + x) * 4;
      const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
      if (a > 32) {
        const scaledX = Math.floor((x + 0.5) * scaleX);
        const scaledY = Math.floor((y + 0.5) * scaleY);
        result.push({
          x: Math.min(canvasWidth - 1, scaledX),
          y: Math.min(canvasHeight - 1, scaledY),
          color: `rgba(${r},${g},${b},${a / 255})`
        });
      }
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

/**
 * Project a 3D point onto the 2D canvas plane using simple perspective.
 * z = 0 means on the screen plane; positive z moves away from the viewer (shrinks);
 * negative z moves toward the viewer (grows). Valid range: z > -FOCAL_LENGTH.
 *
 * @param {number} x  Pre-projection x position
 * @param {number} y  Pre-projection y position
 * @param {number} z  Depth value (must be > -FOCAL_LENGTH)
 * @param {number} cx Canvas centre x
 * @param {number} cy Canvas centre y
 * @returns {{ px: number, py: number, scale: number }}
 */
export function projectParticle(x, y, z, cx, cy) {
  const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z);
  return { px: cx + (x - cx) * scale, py: cy + (y - cy) * scale, scale };
}
