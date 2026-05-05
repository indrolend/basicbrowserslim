import { initOrbHero3D } from "./music/OrbHero3D.js";

export function renderHero({ heroSpec, host, musicManager }) {
  host.replaceChildren();

  if (!heroSpec || typeof heroSpec !== "object") {
    return () => {};
  }

  if (heroSpec.kind === "text") {
    const text = document.createElement("div");
    text.className = "hero-text";
    text.textContent = heroSpec.text || "";
    host.appendChild(text);
    return () => {};
  }

  if (heroSpec.kind === "image" || heroSpec.kind === "gif") {
    const media = document.createElement("img");
    media.className = "hero-media";
    media.src = heroSpec.src;
    media.alt = heroSpec.alt || "";
    media.loading = "eager";
    host.appendChild(media);
    return () => {};
  }

  if (heroSpec.kind === "orb") {
    const canvas = document.createElement("canvas");
    canvas.className = "hero-orb-canvas";
    host.appendChild(canvas);

    const orb = initOrbHero3D(canvas, musicManager);
    return () => {
      orb.destroy();
    };
  }

  const fallback = document.createElement("div");
  fallback.className = "hero-text";
  fallback.textContent = "Unsupported hero";
  host.appendChild(fallback);
  return () => {};
}
