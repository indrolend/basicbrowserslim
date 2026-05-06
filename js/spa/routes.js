// routes.js — sets window.__INDROLEND_ROUTES__ with per-item click actions
// clickAction is either an https:// URL (opens in new tab) or 'overlay:{id}'
(function() {
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
})();
