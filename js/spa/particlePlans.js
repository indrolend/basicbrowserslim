// particlePlans.js — particle plan builders
//
// Each builder returns { particles, phases } for use with particleEngine.runParticleAnimation.
// Plans are pure data: they do not touch the DOM or any canvas directly.

import { PARTICLE_SIZE, EXPLODE_Z_RANGE, MIN_DEPTH_ALPHA, sampleParticles, sampleByCoverage, shuffle, parseRgba, projectParticle } from './particleSampler.js';

// ─── Color helpers ────────────────────────────────────────────────────────────

function lerpColor(from, to, t) {
  const p = Math.max(0, Math.min(1, t));
  const r = Math.round(from[0] + (to[0] - from[0]) * p);
  const g = Math.round(from[1] + (to[1] - from[1]) * p);
  const b = Math.round(from[2] + (to[2] - from[2]) * p);
  const a = from[3] + (to[3] - from[3]) * p;
  return `rgba(${r},${g},${b},${a})`;
}

function easeOutBack(t) {
  const p = Math.max(0, Math.min(1, t));
  const s = 1.1;
  const u = p - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

// ─── Explode → Reform ─────────────────────────────────────────────────────────

/**
 * Build a standard explode-then-reform particle plan.
 * Used for normal hero-to-hero transitions.
 *
 * @param {{ canvas: HTMLCanvasElement, width: number, height: number }} fromRegion
 * @param {{ canvas: HTMLCanvasElement, width: number, height: number }} toRegion
 * @param {number} canvasWidth   — size of the transition canvas
 * @param {number} canvasHeight
 * @returns {{ particles: Array, phases: Array }}
 */
export function buildExplodeReformPlan(fromRegion, toRegion, canvasWidth, canvasHeight) {
  const EXPLODE_DURATION = 120;
  const REFORM_DURATION  = 230;
  const EXPLODE_RADIUS   = Math.min(canvasWidth, canvasHeight) * 0.4;
  const PARTICLE_COUNT   = Math.floor(
    (Math.max(fromRegion.width, toRegion.width) * Math.max(fromRegion.height, toRegion.height)) /
    (PARTICLE_SIZE * PARTICLE_SIZE)
  );

  const rawFrom = sampleParticles(fromRegion, canvasWidth, canvasHeight);
  const rawTo   = sampleParticles(toRegion,   canvasWidth, canvasHeight);
  const fromP   = rawFrom.length ? rawFrom : rawTo;
  const toP     = rawTo.length   ? rawTo   : rawFrom;

  const N        = (fromP.length && toP.length) ? PARTICLE_COUNT : 0;
  const fromPool = shuffle(sampleByCoverage(fromP, N));
  const toPool   = shuffle(sampleByCoverage(toP,   N));

  const particles = [];
  for (let i = 0; i < N; i++) {
    const s     = fromPool[i], e = toPool[i];
    const angle  = Math.random() * Math.PI * 2;
    const radius = Math.random() * EXPLODE_RADIUS * 0.7 + EXPLODE_RADIUS * 0.3;
    particles.push({
      x0: s.x, y0: s.y, c0: parseRgba(s.color),
      x1: e.x, y1: e.y, c1: parseRgba(e.color),
      ex: s.x + Math.cos(angle) * radius,
      ey: s.y + Math.sin(angle) * radius,
      z0: 0,
      ze: Math.random() * EXPLODE_Z_RANGE - EXPLODE_Z_RANGE * 0.5,
      z1: 0
    });
  }

  const phases = [
    {
      duration: EXPLODE_DURATION,
      tick(elapsed, pts, ctx) {
        const p  = elapsed / EXPLODE_DURATION;
        const cx = ctx.canvas.width  / 2;
        const cy = ctx.canvas.height / 2;
        for (const pt of pts) {
          const x = pt.x0 + (pt.ex - pt.x0) * p;
          const y = pt.y0 + (pt.ey - pt.y0) * p;
          const z = pt.z0 + (pt.ze - pt.z0) * p;
          const { px, py, scale } = projectParticle(x, y, z, cx, cy);
          ctx.globalAlpha = Math.max(MIN_DEPTH_ALPHA, Math.min(1, scale));
          ctx.fillStyle = `rgba(${pt.c0[0]},${pt.c0[1]},${pt.c0[2]},${pt.c0[3]})`;
          ctx.beginPath();
          ctx.arc(px, py, (PARTICLE_SIZE / 2) * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },
    {
      duration: REFORM_DURATION,
      tick(elapsed, pts, ctx) {
        const p     = elapsed / REFORM_DURATION;
        const moveP = easeOutBack(p);
        const cx    = ctx.canvas.width  / 2;
        const cy    = ctx.canvas.height / 2;
        for (const pt of pts) {
          const x = pt.ex + (pt.x1 - pt.ex) * moveP;
          const y = pt.ey + (pt.y1 - pt.ey) * moveP;
          const z = pt.ze + (pt.z1 - pt.ze) * p;
          const { px, py, scale } = projectParticle(x, y, z, cx, cy);
          ctx.globalAlpha = Math.max(MIN_DEPTH_ALPHA, Math.min(1, scale));
          ctx.fillStyle = lerpColor(pt.c0, pt.c1, p);
          ctx.beginPath();
          ctx.arc(px, py, (PARTICLE_SIZE / 2) * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  ];

  return { particles, phases };
}

// ─── Pull → Reform ───────────────────────────────────────────────────────────

/**
 * Build a slingshot pull-reform plan.
 * Particles start from their last pulled preview positions and converge onto the target hero.
 *
 * @param {Array<{x: number, y: number, color: string}>} pulledParticles   Last preview frame
 * @param {{ canvas: HTMLCanvasElement, width: number, height: number }} toRegion
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @returns {{ particles: Array, phases: Array } | null}
 */
export function buildPullReformPlan(pulledParticles, toRegion, canvasWidth, canvasHeight) {
  if (!pulledParticles?.length) return null;

  const REFORM_DURATION = 270;

  const rawTo = sampleParticles(toRegion, canvasWidth, canvasHeight);
  if (!rawTo.length) return null;

  const N      = Math.max(pulledParticles.length, rawTo.length);
  const toPool = shuffle(sampleByCoverage(rawTo, N));

  const particles = [];
  for (let i = 0; i < N; i++) {
    const pulled = pulledParticles[i % pulledParticles.length];
    const end    = toPool[i % toPool.length];
    particles.push({
      x0: pulled.x, y0: pulled.y, c0: parseRgba(pulled.color),
      x1: end.x,    y1: end.y,   c1: parseRgba(end.color),
      ze: Math.random() * EXPLODE_Z_RANGE * 0.5 - EXPLODE_Z_RANGE * 0.25
    });
  }

  const phases = [{
    duration: REFORM_DURATION,
    tick(elapsed, pts, ctx) {
      const p     = Math.min(elapsed / REFORM_DURATION, 1);
      const moveP = easeOutBack(p);
      const cx    = ctx.canvas.width  / 2;
      const cy    = ctx.canvas.height / 2;
      for (const pt of pts) {
        const x = pt.x0 + (pt.x1 - pt.x0) * moveP;
        const y = pt.y0 + (pt.y1 - pt.y0) * moveP;
        // z starts at ze and returns to 0 as reform completes
        const z = pt.ze * (1 - p);
        const { px, py, scale } = projectParticle(x, y, z, cx, cy);
        ctx.globalAlpha = Math.max(MIN_DEPTH_ALPHA, Math.min(1, scale));
        ctx.fillStyle = lerpColor(pt.c0, pt.c1, p);
        ctx.beginPath();
        ctx.arc(px, py, (PARTICLE_SIZE / 2) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }];

  return { particles, phases };
}
