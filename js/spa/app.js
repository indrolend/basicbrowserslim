import { createNavigation } from "./navigation.js";
import { createOverlayManager } from "./overlayManager.js";
import { sections } from "./routes.js";
import { createViewRenderer } from "./renderView.js";
import { createState } from "./state.js";
import { createTransitionController } from "./transitionController.js";
import { initMusicButton } from "./music/musicButton.js";
import { createMusicManager } from "./music/musicManager.js";
import { initOrbHero3D } from "./music/OrbHero3D.js";

function requireNode(id) {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing required element: #${id}`);
  }
  return node;
}

export function initApp() {
  const navHost = requireNode("spa-nav");
  const itemNavHost = requireNode("spa-item-nav");
  const heroHost = requireNode("spa-hero-host");
  const contentHost = requireNode("spa-content-host");
  const overlayRoot = requireNode("spa-overlay-root");

  const state = createState();
  const musicManager = createMusicManager();

  // Create the single persistent orb canvas that is the hero surface
  const orbCanvas = document.createElement("canvas");
  orbCanvas.className = "hero-orb-canvas";
  heroHost.appendChild(orbCanvas);
  const orb = initOrbHero3D(orbCanvas, musicManager);

  const viewRenderer = createViewRenderer({ contentHost });

  let navigation;
  const renderCurrent = () => {
    const { sectionIndex, itemIndex } = state.getState();
    const section = sections[sectionIndex];
    const item = section.items[itemIndex];
    viewRenderer.render(item);
    if (navigation) {
      navigation.refresh();
    }
  };

  const overlayManager = createOverlayManager({
    root: overlayRoot,
    setOverlay: state.setOverlay,
  });

  const transitionController = createTransitionController({
    routes: sections,
    getState: state.getState,
    setActive: state.setActive,
    setTransitioning: state.setTransitioning,
    orb,
    renderCurrent,
  });

  navigation = createNavigation({
    navHost,
    itemNavHost,
    routes: sections,
    getState: state.getState,
    goTo: transitionController.goToWithTransition,
  });

  initMusicButton({
    host: document.body,
    overlayManager,
    musicManager,
  });

  renderCurrent();
}
