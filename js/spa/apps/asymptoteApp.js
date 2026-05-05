// asymptoteApp.js — Asymptote game stub
// Registers with window.__SPA_Views['games'] if a game-mode SPA is present.
// Full implementation would mount the Asymptote procedural animation.
(function() {
  // Minimal stub so main.js onActivate/onDeactivate calls don't throw.
  // Replace this with the real Asymptote engine implementation.
  window.__SPA_Views = window.__SPA_Views || {};

  // Note: the full games section view is registered by gamesView.js.
  // asymptoteApp.js handles the game engine that runs inside the games view.

  // Expose a global to let main.js tell us game mode is active/inactive.
  // window.__SPA_SetGameMode is wired up in main.js.
})();
