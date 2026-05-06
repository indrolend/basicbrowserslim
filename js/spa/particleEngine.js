// particleEngine.js — pure particle animation runner
//
// Owns: running a ParticlePlan (built by particlePlans.js) against a 2D canvas context.
// Does NOT own: canvas sizing, DOM handoff, transition lifecycle, or particle sampling.
//
// Usage:
//   runParticleAnimation(ctx, plan, onComplete)
//
// A plan is { particles: Array, phases: Array<{ duration: ms, tick(elapsed, particles, ctx) }> }.

/**
 * Run a particle animation plan on `ctx`.
 * Calls `onComplete` when the last phase finishes or if the canvas is disconnected.
 *
 * Phases are executed in order. Each phase's `tick` receives the time elapsed
 * since that phase started (in ms) and should draw one frame to `ctx`.
 * The engine calls ctx.clearRect before each tick.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ particles: Array, phases: Array<{duration: number, tick: Function}> }} plan
 * @param {Function} [onComplete]
 */
export function runParticleAnimation(ctx, plan, onComplete) {
  const { particles, phases } = plan;
  const width  = ctx.canvas.width;
  const height = ctx.canvas.height;
  let completed = false;

  function safeComplete() {
    if (completed) return;
    completed = true;
    if (typeof onComplete === 'function') onComplete();
  }

  if (!particles.length || !phases.length) { safeComplete(); return; }

  // Pre-compute absolute start time of each phase.
  const phaseOffsets = [];
  let offset = 0;
  for (const phase of phases) { phaseOffsets.push(offset); offset += phase.duration; }
  const totalDuration = offset;

  let startTime = null;

  function animate(ts) {
    if (!ctx.canvas.isConnected) { safeComplete(); return; }
    if (startTime === null) startTime = ts;
    const elapsed = ts - startTime;

    if (elapsed >= totalDuration) { safeComplete(); return; }

    ctx.clearRect(0, 0, width, height);

    // Locate the active phase (last one whose offset <= elapsed).
    let pi = 0;
    while (pi + 1 < phases.length && elapsed >= phaseOffsets[pi + 1]) pi++;
    phases[pi].tick(elapsed - phaseOffsets[pi], particles, ctx);

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
