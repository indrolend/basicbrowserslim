// navModel.js — navigation target computation

import { SPA_SECTIONS, getSection } from './spaData.js';

export function getAvailableSections(homeSectionLocked) {
  return homeSectionLocked ? SPA_SECTIONS.filter((_, i) => i !== 0) : SPA_SECTIONS;
}

export function getNextTarget(si, ii, homeSectionLocked) {
  const section = getSection(si);
  if (!section) return null;
  if (ii + 1 < section.items.length) return { sectionIdx: si, itemIdx: ii + 1 };
  const avail = getAvailableSections(homeSectionLocked);
  const pos   = avail.findIndex(s => s === section);
  const next  = avail[(pos + 1) % avail.length];
  return { sectionIdx: SPA_SECTIONS.indexOf(next), itemIdx: 0 };
}

export function getPrevTarget(si, ii, homeSectionLocked) {
  const section = getSection(si);
  if (!section) return null;
  if (ii - 1 >= 0) return { sectionIdx: si, itemIdx: ii - 1 };
  const avail = getAvailableSections(homeSectionLocked);
  const pos   = avail.findIndex(s => s === section);
  const prev  = avail[(pos - 1 + avail.length) % avail.length];
  const prevSi = SPA_SECTIONS.indexOf(prev);
  return { sectionIdx: prevSi, itemIdx: SPA_SECTIONS[prevSi].items.length - 1 };
}

// Convenience wrapper: returns next or prev target based on direction string.
export function getTargetForDirection(direction, si, ii, homeSectionLocked) {
  return direction === 'next'
    ? getNextTarget(si, ii, homeSectionLocked)
    : getPrevTarget(si, ii, homeSectionLocked);
}
