export function createTransitionController({
  routes,
  getState,
  setActive,
  setTransitioning,
  orb,
  renderCurrent,
}) {
  async function goToWithTransition(sectionIndex, itemIndex) {
    const snapshot = getState();
    if (snapshot.isTransitioning) {
      return;
    }

    if (snapshot.sectionIndex === sectionIndex && snapshot.itemIndex === itemIndex) {
      return;
    }

    const targetItem = routes[sectionIndex]?.items[itemIndex];
    if (!targetItem) return;

    setTransitioning(true);
    try {
      await orb.morphTo(targetItem.hero);
      setActive(sectionIndex, itemIndex);
      renderCurrent();
    } catch (err) {
      console.error("Morph failed.", err);
      setActive(sectionIndex, itemIndex);
      renderCurrent();
    } finally {
      setTransitioning(false);
    }
  }

  return { goToWithTransition };
}
