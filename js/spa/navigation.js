export function createNavigation({ navHost, itemNavHost, routes, getState, goTo }) {
  function buildButton({ label, isActive, onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-current", isActive ? "true" : "false");
    button.addEventListener("click", onClick);
    return button;
  }

  function renderSectionNav() {
    const { sectionIndex, isTransitioning } = getState();
    navHost.replaceChildren();

    routes.forEach((section, index) => {
      if (section.hidden) {
        return;
      }
      const button = buildButton({
        label: section.label,
        isActive: index === sectionIndex,
        onClick: () => {
          if (isTransitioning) {
            return;
          }
          goTo(index, 0);
        },
      });
      navHost.appendChild(button);
    });
  }

  function renderItemNav() {
    const { sectionIndex, itemIndex, isTransitioning } = getState();
    const activeSection = routes[sectionIndex];
    itemNavHost.replaceChildren();

    activeSection.items.forEach((item, index) => {
      const button = buildButton({
        label: item.title,
        isActive: index === itemIndex,
        onClick: () => {
          if (isTransitioning) {
            return;
          }
          goTo(sectionIndex, index);
        },
      });
      itemNavHost.appendChild(button);
    });
  }

  function refresh() {
    renderSectionNav();
    renderItemNav();
  }

  refresh();

  return {
    refresh,
  };
}
