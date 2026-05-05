// slingshotPreview.js — slingshot pull-preview particle sampling and rendering
//
// Usage:
//   const preview = createSlingshotPreview({ transitionCanvas, transitionCtx });
//   preview.reset();                                      // call on lock/cleanup
//   const result = preview.renderPullPreview(pullVector, pullNormalized, pullFromSurface);
//   // result: { particles, canvasW, canvasH } | null

import { SLINGSHOT_PARTICLE_SIZE, STRETCH_MAX, TRAIL_BIAS } from './spaData.js';

export function createSlingshotPreview({ transitionCanvas, transitionCtx }) {
  let _pullOffscreen         = null;
  let pullPreviewParticlesBase = null;

  function reset() {
    pullPreviewParticlesBase = null;
  }

  function sampleParticles(surface, cw, ch) {
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
          result.push({ x, y, cx: x - cx0, cy: y - cy0,
            color: `rgba(${data[idx]},${data[idx+1]},${data[idx+2]},${(data[idx+3]/255).toFixed(2)})`,
            frayX: Math.random() * 2 - 1, frayY: Math.random() * 2 - 1 });
        }
      }
    }
    return result;
  }

  // Renders the slingshot pull preview onto the transition canvas.
  // Returns { particles, canvasW, canvasH } when particles were drawn, or null.
  function renderPullPreview(pullVector, pullNormalized, pullFromSurface) {
    if (!pullFromSurface) return null;
    const cw = transitionCanvas.width, ch = transitionCanvas.height;
    transitionCtx.clearRect(0, 0, cw, ch);

    const len  = Math.sqrt(pullVector.x * pullVector.x + pullVector.y * pullVector.y);
    const pnx  = len > 0 ? pullVector.x / len : 0;
    const pny  = len > 0 ? pullVector.y / len : 0;
    const maxR = Math.min(cw, ch) * 0.5;

    if (pullNormalized < 0.25) {
      // Phase A: solid hero — no particles yet
      const dx = (cw - pullFromSurface.width) / 2, dy = (ch - pullFromSurface.height) / 2;
      transitionCtx.drawImage(pullFromSurface.canvas, 0, 0, pullFromSurface.width, pullFromSurface.height, dx, dy, pullFromSurface.width, pullFromSurface.height);
      pullPreviewParticlesBase = null;
      return null;
    }

    // Phase B (0.25→0.65): fray particles
    // Phase C (0.65→1.0): full preview
    if (!pullPreviewParticlesBase) {
      pullPreviewParticlesBase = sampleParticles(pullFromSurface, cw, ch);
    }

    const phaseB = Math.min(1, (pullNormalized - 0.25) / 0.4);

    if (phaseB < 1) {
      transitionCtx.globalAlpha = 1 - phaseB;
      const dx = (cw - pullFromSurface.width) / 2, dy = (ch - pullFromSurface.height) / 2;
      transitionCtx.drawImage(pullFromSurface.canvas, 0, 0, pullFromSurface.width, pullFromSurface.height, dx, dy, pullFromSurface.width, pullFromSurface.height);
      transitionCtx.globalAlpha = 1;
    }

    const particles     = pullPreviewParticlesBase;
    const drawnParticles = [];
    transitionCtx.globalAlpha = Math.min(1, phaseB * 2);

    for (const p of particles) {
      const proj      = (p.cx * pnx + p.cy * pny) / (maxR * 0.5);
      const asymScale = proj >= 0 ? 0.4 : 1.2;
      const stretch   = proj * pullNormalized * STRETCH_MAX * asymScale;
      const trailX    = -pnx * TRAIL_BIAS + p.frayX * (1 - TRAIL_BIAS);
      const trailY    = -pny * TRAIL_BIAS + p.frayY * (1 - TRAIL_BIAS);
      const nx = p.x + trailX * stretch;
      const ny = p.y + trailY * stretch;
      drawnParticles.push({ x: nx, y: ny, color: p.color });
      transitionCtx.fillStyle = p.color;
      transitionCtx.beginPath();
      transitionCtx.arc(nx, ny, SLINGSHOT_PARTICLE_SIZE / 2, 0, Math.PI * 2);
      transitionCtx.fill();
    }

    transitionCtx.globalAlpha = 1;
    return { particles: drawnParticles, canvasW: cw, canvasH: ch };
  }

  return { reset, sampleParticles, renderPullPreview };
}
