// renderNav.js — section nav and item-dot DOM rendering
//
// Usage:
//   const nav = createNavRenderer({ dotsContainer });
//   nav.updateSectionNav(sectionIdx, homeSectionLocked);
//   nav.updateItemDots(sectionIdx, itemIdx);

import { SPA_SECTIONS, getSection } from './spaData.js';

export function createNavRenderer({ dotsContainer }) {

  function updateSectionNav(si, homeSectionLocked) {
    let nav = document.getElementById('spa-section-nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'spa-section-nav';
      nav.setAttribute('aria-label', 'Sections');
      document.body.insertBefore(nav, document.body.firstChild);
    }
    nav.innerHTML = '';
    const sectionsToShow = homeSectionLocked
      ? SPA_SECTIONS.filter((_, i) => i !== 0)
      : SPA_SECTIONS;
    for (const section of sectionsToShow) {
      const idx = SPA_SECTIONS.indexOf(section);
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'spa-nav-btn';
      btn.textContent = section.label;
      if (idx === si) {
        btn.style.fontWeight = 'bold';
        btn.style.background = '#333';
        btn.setAttribute('aria-current', 'page');
      }
      btn.dataset.action = 'goto-section';
      btn.dataset.sectionIdx = String(idx);
      nav.appendChild(btn);
    }
  }

  function updateItemDots(si, ii) {
    dotsContainer.innerHTML = '';
    const section = getSection(si);
    if (!section || section.items.length <= 1) return;
    section.items.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'spa-dot';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', item.label);
      btn.setAttribute('aria-selected', idx === ii ? 'true' : 'false');
      btn.dataset.action = 'goto-item';
      btn.dataset.sectionIdx = String(si);
      btn.dataset.itemIdx = String(idx);
      dotsContainer.appendChild(btn);
    });
  }

  return { updateSectionNav, updateItemDots };
}
