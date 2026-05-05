export function createViewRenderer({ contentHost }) {
  function clear() {
    contentHost.replaceChildren();
  }

  function render(item) {
    const heading = document.createElement("h2");
    heading.textContent = item.title;

    const body = document.createElement("p");
    body.textContent = item.body;

    contentHost.replaceChildren(heading, body);

    if (Array.isArray(item.links) && item.links.length > 0) {
      const list = document.createElement("ul");
      item.links.forEach((link) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = link.href;
        a.target = "_blank";
        a.rel = "noreferrer noopener";
        a.textContent = link.label;
        li.appendChild(a);
        list.appendChild(li);
      });
      contentHost.appendChild(list);
    }
  }

  return {
    render,
    clear,
  };
}