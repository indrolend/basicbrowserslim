// renderHero.js — hero DOM rendering and click-action wiring
//
// Usage:
//   const hero = createHeroRenderer({ heroContainer, onAction });
//   hero.renderHeroDOM(sectionIdx, itemIdx);

import { getSection, getItem, getHeroSpec, getClickAction } from './spaData.js';
import { addActivationHandler } from './utils.js';

export function createHeroRenderer({ heroContainer, onAction }) {

  function renderHeroDOM(si, ii) {
    heroContainer.innerHTML = '';

    const section = getSection(si);
    const item    = getItem(si, ii);
    if (!section || !item) return;

    // Delegate to external view module if registered
    const viewModule = window.__SPA_Views?.[section.id];
    if (viewModule?.mount) { viewModule.mount(item.id, heroContainer); return; }

    const heroSpec    = getHeroSpec(si, ii);
    const clickAction = getClickAction(si, ii);

    const wrapper = document.createElement('div');
    wrapper.className = 'spa-hero';
    wrapper.setAttribute('draggable', 'false');
    wrapper.addEventListener('dragstart', (e) => e.preventDefault());

    if (clickAction) {
      wrapper.classList.add('spa-hero--linkable');
      wrapper.setAttribute('role', 'link');
      wrapper.setAttribute('tabindex', '0');
      wrapper.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAction(clickAction); }
      });
      addActivationHandler(wrapper, () => onAction(clickAction));
    }

    if (heroSpec.kind === 'image') {
      const img = document.createElement('img');
      img.className = 'spa-hero-image';
      img.src       = heroSpec.src;
      img.width     = 320;
      img.height    = 320;
      img.style.objectFit = 'contain';
      img.setAttribute('draggable', 'false');
      wrapper.appendChild(img);
    } else {
      wrapper.classList.add('spa-hero--text');
      const textEl = document.createElement('div');
      textEl.className   = 'spa-hero-text';
      textEl.textContent = heroSpec.text || item.label;
      wrapper.appendChild(textEl);
    }

    heroContainer.appendChild(wrapper);
  }

  return { renderHeroDOM };
}
