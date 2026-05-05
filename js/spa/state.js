export function createState() {
  const state = {
    sectionIndex: 0,
    itemIndex: 0,
    isTransitioning: false,
    overlay: null,
  };

  function getState() {
    return { ...state };
  }

  function setActive(sectionIndex, itemIndex) {
    state.sectionIndex = sectionIndex;
    state.itemIndex = itemIndex;
  }

  function setTransitioning(isTransitioning) {
    state.isTransitioning = Boolean(isTransitioning);
  }

  function setOverlay(idOrNull) {
    state.overlay = idOrNull;
  }

  return {
    getState,
    setActive,
    setTransitioning,
    setOverlay,
  };
}
