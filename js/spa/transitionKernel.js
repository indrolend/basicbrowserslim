// transitionKernel.js — canvas alignment, DOM handoff, and particle lifecycle
//
// Merges: transitionRunner.js, slingshotPreview.js, and the slingshot reveal handoff
// that was previously inlined in main.js.
//
// Owns:
//   - Transition canvas sizing and positioning
//   - Hero DOM show/hide (canvas ↔ hero handoff)
//   - Running ParticlePlan animations via particleEngine
//   - Slingshot pull-preview interactive rendering
//   - Reveal handoff (canvas fade-out, hero fade-in)
//
// Does NOT own: navigation state, routing, surface rasterization, or app lifecycle.

import { STAGE_PADDING_PX, REVEAL_HANDOFF_FADE_MS, SLINGSHOT_PARTICLE_SIZE, STRETCH_MAX, TRAIL_BIAS } from './spaData.js';
import { waitRaf, waitMs } from './utils.js';
import { runParticleAnimation } from './particleEngine.js';
import { buildExplodeReformPlan, buildPullReformPlan } from './particlePlans.js';
import { projectParticle, MIN_DEPTH_ALPHA, PULL_Z_RANGE } from './particleSampler.js';

export function createTransitionKernel({ transitionCanvas, transitionCtx, heroContainer }) {

  // ─── Pull-preview state ───────────────────────────────────────────────────

  let _pullOffscreen       = null;
  let _pullParticlesBase   = null;

  // ─── Canvas helpers ───────────────────────────────────────────────────────

  function alignCanvas(fromSurface, toSurface) {
    const stageW = Math.max(fromSurface?.width ?? 0, toSurface?.width ?? 0) + STAGE_PADDING_PX * 2;
    const stageH = Math.max(fromSurface?.height ?? 0, toSurface?.height ?? 0) + STAGE_PADDING_PX * 2;
    transitionCanvas.width  = Math.max(stageW, 64);
    transitionCanvas.height = Math.max(stageH, 64);

    const rootRect = document.getElementById('spa-root').getBoundingClientRect();
    const heroRect = heroContainer.getBoundingClientRect();
    const cx = heroRect.left + heroRect.width  / 2 - rootRect.left;
    const cy = heroRect.top  + heroRect.height / 2 - rootRect.top;
    transitionCanvas.style.left = `${cx}px`;
    transitionCanvas.style.top  = `${cy}px`;
  }

  function showCanvas() {
    transitionCanvas.style.display    = 'block';
    transitionCanvas.style.opacity    = '1';
    transitionCanvas.style.transition = '';
  }

  function hideCanvas() {
    transitionCanvas.style.display    = 'none';
    transitionCanvas.style.opacity    = '1';
    transitionCanvas.style.transition = '';
  }

  function hideHero() {
    const heroEl = heroContainer.firstElementChild;
    if (heroEl) { heroEl.style.visibility = 'hidden'; heroEl.style.opacity = '0'; heroEl.style.transition = ''; }
  }

  // ─── Reveal handoff ───────────────────────────────────────────────────────

  async function _revealHandoff(onBeforeReveal) {
    if (onBeforeReveal) await onBeforeReveal();

    const revealHero = heroContainer.firstElementChild;
    if (revealHero) {
      revealHero.style.visibility = 'visible';
      revealHero.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-out`;
    }
    transitionCanvas.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-in`;

    await waitRaf();
    if (revealHero) revealHero.style.opacity = '1';
    transitionCanvas.style.opacity = '0';
    await waitMs(REVEAL_HANDOFF_FADE_MS);

    hideCanvas();
    if (revealHero) revealHero.style.transition = '';
  }

  // ─── Standard hero transition ─────────────────────────────────────────────

  /**
   * Run a standard explode→reform transition between two hero surfaces.
   * Hides the live hero, plays particles, then reveals the new hero.
   *
   * @param {{ canvas, width, height }|null} fromSurface
   * @param {{ canvas, width, height }|null} toSurface
   * @param {{ timingProfile?: string, onBeforeReveal?: Function }} [opts]
   */
  async function runTransition(fromSurface, toSurface, opts = {}) {
    if (!fromSurface || !toSurface) {
      if (opts.onBeforeReveal) await opts.onBeforeReveal();
      return;
    }

    alignCanvas(fromSurface, toSurface);
    hideHero();
    showCanvas();

    const plan = buildExplodeReformPlan(
      fromSurface, toSurface,
      transitionCanvas.width, transitionCanvas.height,
      opts.timingProfile || 'default'
    );

    try {
      await new Promise(resolve => runParticleAnimation(transitionCtx, plan, resolve));
    } finally {
      await _revealHandoff(opts.onBeforeReveal);
    }
  }

  // ─── Slingshot pull-preview ───────────────────────────────────────────────

  /** Reset pull-preview state; call on slingshot lock and cleanup. */
  function resetPullPreview() {
    _pullParticlesBase = null;
  }

  function _samplePullParticles(surface, cw, ch) {
    if (!_pullOffscreen) _pullOffscreen = document.createElement('canvas');
    const c = _pullOffscreen;
    c.width = cw; c.height = ch;
    const cctx = c.getContext('2d');
    cctx.clearRect(0, 0, cw, ch);
    const dx = (cw - surface.width) / 2, dy = (ch - surface.height) / 2;
    cctx.drawImage(surface.canvas, 0, 0, surface.width, surface.height, dx, dy, surface.width, surface.height);
    const data = cctx.getImageData(0, 0, cw, ch).data;
    const cx0 = cw / 2, cy0 = ch / 2;
    const result = [];
    for (let y = 0; y < ch; y += SLINGSHOT_PARTICLE_SIZE) {
      for (let x = 0; x < cw; x += SLINGSHOT_PARTICLE_SIZE) {
        const idx = (y * cw + x) * 4;
        if (data[idx + 3] > 32) {
          result.push({
            x, y,
            cx: x - cx0, cy: y - cy0,
            color: `rgba(${data[idx]},${data[idx + 1]},${data[idx + 2]},${(data[idx + 3] / 255).toFixed(2)})`,
            frayX: Math.random() * 2 - 1,
            frayY: Math.random() * 2 - 1,
            z: 0
          });
        }
      }
    }
    return result;
  }

  /**
   * Render one frame of the slingshot pull preview onto the transition canvas.
   * Returns { particles, canvasW, canvasH } when particles were drawn, or null.
   *
   * @param {{ x: number, y: number }} pullVector
   * @param {number} pullNormalized   0…1
   * @param {{ canvas, width, height }|null} pullFromSurface
   * @returns {{ particles: Array, canvasW: number, canvasH: number } | null}
   */
  function renderPullPreview(pullVector, pullNormalized, pullFromSurface) {
    if (!pullFromSurface) return null;
    const cw = transitionCanvas.width, ch = transitionCanvas.height;
    transitionCtx.clearRect(0, 0, cw, ch);

    const len = Math.sqrt(pullVector.x * pullVector.x + pullVector.y * pullVector.y);
    const pnx = len > 0 ? pullVector.x / len : 0;
    const pny = len > 0 ? pullVector.y / len : 0;
    const maxR = Math.min(cw, ch) * 0.5;

    if (pullNormalized < 0.25) {
      // Phase A: solid hero — particles not yet visible
      const dx = (cw - pullFromSurface.width) / 2, dy = (ch - pullFromSurface.height) / 2;
      transitionCtx.drawImage(pullFromSurface.canvas, 0, 0, pullFromSurface.width, pullFromSurface.height, dx, dy, pullFromSurface.width, pullFromSurface.height);
      _pullParticlesBase = null;
      return null;
    }

    // Phase B (0.25→0.65): fray particles
    // Phase C (0.65→1.0): full stretch preview
    if (!_pullParticlesBase) {
      _pullParticlesBase = _samplePullParticles(pullFromSurface, cw, ch);
    }

    const phaseB = Math.min(1, (pullNormalized - 0.25) / 0.4);

    if (phaseB < 1) {
      transitionCtx.globalAlpha = 1 - phaseB;
      const dx = (cw - pullFromSurface.width) / 2, dy = (ch - pullFromSurface.height) / 2;
      transitionCtx.drawImage(pullFromSurface.canvas, 0, 0, pullFromSurface.width, pullFromSurface.height, dx, dy, pullFromSurface.width, pullFromSurface.height);
      transitionCtx.globalAlpha = 1;
    }

    const particles      = _pullParticlesBase;
    const drawnParticles = [];
    const phaseAlpha     = Math.min(1, phaseB * 2);

    for (const p of particles) {
      const proj      = (p.cx * pnx + p.cy * pny) / (maxR * 0.5);
      const asymScale = proj >= 0 ? 0.4 : 1.2;
      const stretch   = proj * pullNormalized * STRETCH_MAX * asymScale;
      const trailX    = -pnx * TRAIL_BIAS + p.frayX * (1 - TRAIL_BIAS);
      const trailY    = -pny * TRAIL_BIAS + p.frayY * (1 - TRAIL_BIAS);
      const nx = p.x + trailX * stretch;
      const ny = p.y + trailY * stretch;
      // Gentle z tilt based on fray gives a 3D peel-off sense during pull
      const z  = p.frayX * pullNormalized * PULL_Z_RANGE;
      const { px: projX, py: projY, scale } = projectParticle(nx, ny, z, cw / 2, ch / 2);
      // Store projected coordinates so the reform animation starts from the visible position
      drawnParticles.push({ x: projX, y: projY, color: p.color });
      const scaleAlpha = Math.max(MIN_DEPTH_ALPHA, Math.min(1, scale));
      transitionCtx.globalAlpha = phaseAlpha * scaleAlpha;
      transitionCtx.fillStyle = p.color;
      transitionCtx.beginPath();
      transitionCtx.arc(projX, projY, (SLINGSHOT_PARTICLE_SIZE / 2) * scale, 0, Math.PI * 2);
      transitionCtx.fill();
    }

    transitionCtx.globalAlpha = 1;
    return { particles: drawnParticles, canvasW: cw, canvasH: ch };
  }

  function _buildAutoPullParticles(fromSurface, cw, ch, pullVector = { x: 1, y: 0 }) {
    const base = _samplePullParticles(fromSurface, cw, ch);
    if (!base.length) return null;

    const len = Math.sqrt(pullVector.x * pullVector.x + pullVector.y * pullVector.y);
    const pnx = len > 0 ? pullVector.x / len : 1;
    const pny = len > 0 ? pullVector.y / len : 0;
    const maxR = Math.min(cw, ch) * 0.5;
    const cx0 = cw / 2;
    const cy0 = ch / 2;
    const stretch = STRETCH_MAX;

    return base.map((p) => {
      const radial = Math.min(1, Math.sqrt(p.cx * p.cx + p.cy * p.cy) / maxR);
      const bias = TRAIL_BIAS + (1 - TRAIL_BIAS) * radial;
      const mx = p.cx + (pnx * stretch * bias * 1.2);
      const my = p.cy + (pny * stretch * bias * 1.2);
      return { x: cx0 + mx, y: cy0 + my, color: p.color };
    });
  }

  // ─── Slingshot release transition ─────────────────────────────────────────

  /**
   * Run the slingshot release animation.
   * Uses pulled particle positions if available; falls back to standard explode-reform.
   *
   * @param {{ pulledParticles: Array|null, pulledCanvasW: number, pulledCanvasH: number,
   *           fromSurface: Object, toSurface: Object, onBeforeReveal?: Function }} opts
   */
  async function runSlingshotRelease({ pulledParticles, pulledCanvasW, pulledCanvasH, fromSurface, toSurface, onBeforeReveal, autoPullVector }) {
    alignCanvas(fromSurface, toSurface);
    hideHero();
    showCanvas();
    const cw = transitionCanvas.width, ch = transitionCanvas.height;

    // Remap pull particles into the (possibly resized) canvas coordinate space.
    let remapped = null;
    if (pulledParticles?.length) {
      const shiftX = (cw - pulledCanvasW) / 2, shiftY = (ch - pulledCanvasH) / 2;
      remapped = pulledParticles.map(p => ({ x: p.x + shiftX, y: p.y + shiftY, color: p.color }));
    }

    const syntheticPulled = (!remapped && fromSurface)
      ? _buildAutoPullParticles(fromSurface, cw, ch, autoPullVector || { x: 1, y: 0 })
      : null;

    const plan = (remapped || syntheticPulled)
      ? buildPullReformPlan(remapped || syntheticPulled, toSurface, cw, ch, null)
      : null;

    const finalPlan = plan || buildExplodeReformPlan(fromSurface, toSurface, cw, ch, 'default');

    await new Promise(resolve => runParticleAnimation(transitionCtx, finalPlan, resolve));
    await _revealHandoff(onBeforeReveal);
  }

  return {
    alignCanvas,
    showCanvas,
    hideCanvas,
    hideHero,
    runTransition,
    resetPullPreview,
    renderPullPreview,
    runSlingshotRelease
  };
}
