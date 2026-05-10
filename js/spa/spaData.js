// spaData.js — SPA section/item data, constants, and pure data accessors

window.__INDROLEND_ROUTES__ = {
  items: {
    // Social
    'social/tiktok':    { clickAction: 'https://www.tiktok.com/@indrolend' },
    'social/instagram': { clickAction: 'https://www.instagram.com/indrolend' },
    'social/youtube':   { clickAction: 'https://www.youtube.com/@indrolend' },
    // Music
    'music/spotify':    { clickAction: 'https://open.spotify.com/artist/indrolend' },
    'music/appleMusic': { clickAction: 'https://music.apple.com/us/artist/indrolend' },
    'music/bandcamp':   { clickAction: 'https://indrolend.bandcamp.com' },
    'music/soundcloud': { clickAction: 'overlay:soundcloud' },
    // Games
    'games/asymptote':  { clickAction: 'overlay:asymptote' },
    // Transition Lab
    'transitionLab/labTextStart':      { clickAction: null },
    'transitionLab/labImageNormal':    { clickAction: null },
    'transitionLab/labGifFull':        { clickAction: null },
    'transitionLab/labImageOffset':    { clickAction: null },
    'transitionLab/labGifTransparent': { clickAction: null },
    'transitionLab/labTextEnd':        { clickAction: null }
  }
};

// ─── Sections data ────────────────────────────────────────────────────────────

export const SPA_SECTIONS = [
  {
    id: 'home', label: 'Home',
    items: [
      { id: 'orb', label: 'Indrolend', hero: { kind: 'text', text: 'INDROLEND' }, swipe: true }
    ]
  },
  {
    id: 'social', label: 'Social',
    items: [
      { id: 'tiktok',    label: 'TikTok',    hero: { kind: 'image', src: 'gifs/Tiktoklogospin.gif' } },
      { id: 'instagram', label: 'Instagram', hero: { kind: 'image', src: 'gifs/Instagramlogospin.gif' } },
      { id: 'youtube',   label: 'YouTube',   hero: { kind: 'image', src: 'gifs/Youtubelogospin.gif' } }
    ]
  },
  {
    id: 'music', label: 'Music',
    items: [
      { id: 'spotify',    label: 'Spotify',     hero: { kind: 'image', src: 'gifs/Spotifylogospin.gif' } },
      { id: 'appleMusic', label: 'Apple Music', hero: { kind: 'image', src: 'gifs/Applemusiclogospin.gif' } },
      { id: 'bandcamp',   label: 'Bandcamp',    hero: { kind: 'image', src: 'gifs/bandcamplogospin.gif' } },
      { id: 'soundcloud', label: 'SoundCloud',  hero: { kind: 'image', src: 'gifs/soundcloudlogospin.gif' } }
    ]
  },
  {
    id: 'games', label: 'Games',
    items: [
      { id: 'asymptote', label: 'Asymptote Engine', hero: { kind: 'text', text: 'Asymptote Engine' } }
    ]
  },
  {
    id: 'transitionLab', label: 'Transition Lab',
    items: [
      { id: 'labTextStart', label: 'T1 Text', hero: { kind: 'text', text: 'Transition Lab' } },
      { id: 'labImageNormal', label: 'T2 Image', hero: { kind: 'image', src: 'assets/test-heroes/normal-image.png' } },
      { id: 'labGifFull', label: 'T3 GIF Full', hero: { kind: 'image', src: 'assets/test-heroes/fullframe-icon.gif' } },
      { id: 'labImageOffset', label: 'T4 Image Alpha', hero: { kind: 'image', src: 'assets/test-heroes/offset-alpha-bounds.png' } },
      { id: 'labGifTransparent', label: 'T5 GIF Transparent', hero: { kind: 'image', src: 'assets/test-heroes/transparent-logo.gif' } },
      { id: 'labTextEnd', label: 'T6 Text', hero: { kind: 'text', text: 'Done' } }
    ]
  }
];

// ─── Constants ────────────────────────────────────────────────────────────────

export const STAGE_PADDING_PX        = 72;
export const SLINGSHOT_MIN_RELEASE   = 0.15;
export const REVEAL_HANDOFF_FADE_MS  = 70;
export const STRETCH_MAX             = 55;
export const TRAIL_BIAS              = 0.55;
export const SLINGSHOT_PARTICLE_SIZE = 4;

// ─── Pure data accessors ──────────────────────────────────────────────────────

export function getSection(si)      { return SPA_SECTIONS[si] ?? null; }
export function getItem(si, ii)     { return SPA_SECTIONS[si]?.items[ii] ?? null; }
export function getHeroSpec(si, ii) { return getItem(si, ii)?.hero ?? { kind: 'text', text: '' }; }

export function getClickAction(si, ii) {
  const section = getSection(si);
  const item    = getItem(si, ii);
  if (!section || !item) return null;
  return window.__INDROLEND_ROUTES__?.items?.[`${section.id}/${item.id}`]?.clickAction ?? null;
}
