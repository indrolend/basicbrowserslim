// transitionRunner.js — canvas alignment and hero transition orchestration
//
// Usage:
//   const runner = createTransitionRunner({ transitionCanvas, transitionCtx,
//                                           heroContainer, transition });
//   runner.alignTransitionCanvas(fromSurface, toSurface);
//   await runner.runHeroTransition(fromSurface, toSurface, opts);

import { STAGE_PADDING_PX, REVEAL_HANDOFF_FADE_MS } from './spaData.js';
import { waitRaf, waitMs } from './utils.js';

export function createTransitionRunner({ transitionCanvas, transitionCtx, heroContainer, transition }) {

  function alignTransitionCanvas(fromSurface, toSurface) {
    const stageW = Math.max(fromSurface?.width  ?? 0, toSurface?.width  ?? 0) + STAGE_PADDING_PX * 2;
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

  async function runHeroTransition(fromSurface, toSurface, opts = {}) {
    if (!fromSurface || !toSurface) {
      if (opts.onBeforeReveal) await opts.onBeforeReveal();
      return;
    }

    alignTransitionCanvas(fromSurface, toSurface);

    // Hide live hero, show canvas
    const heroEl = heroContainer.firstElementChild;
    if (heroEl) { heroEl.style.visibility = 'hidden'; heroEl.style.opacity = '0'; heroEl.style.transition = ''; }
    transitionCanvas.style.display    = 'block';
    transitionCanvas.style.opacity    = '1';
    transitionCanvas.style.transition = '';

    try {
      await new Promise(resolve => {
        transition(fromSurface.canvas, toSurface.canvas, {
          ctx:           transitionCtx,
          fromRegion:    fromSurface,
          toRegion:      toSurface,
          timingProfile: opts.timingProfile || 'default'
        }, resolve);
      });
    } finally {
      if (opts.onBeforeReveal) await opts.onBeforeReveal();

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

      transitionCanvas.style.display    = 'none';
      transitionCanvas.style.opacity    = '1';
      transitionCanvas.style.transition = '';
      if (revealHero) revealHero.style.transition = '';
    }
  }

  return { alignTransitionCanvas, runHeroTransition };
}
