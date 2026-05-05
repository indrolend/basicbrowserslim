import { renderMusicPlayerSection } from "./musicPlayerSection.js";

export function initMusicButton({ host, overlayManager, musicManager }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "music-fab";

  const label = document.createElement("span");
  label.textContent = "Music";

  const miniCanvas = document.createElement("canvas");
  miniCanvas.width = 96;
  miniCanvas.height = 40;

  button.append(label, miniCanvas);

  const openOverlay = () => {
    overlayManager.open("music", (overlayHost) =>
      renderMusicPlayerSection({
        host: overlayHost,
        musicManager,
      })
    );
  };

  button.addEventListener("click", openOverlay);
  host.appendChild(button);

  const miniCtx = miniCanvas.getContext("2d");
  let rafId = 0;

  function drawMiniAnalyser() {
    if (!miniCtx) {
      return;
    }

    const wave = musicManager.getWaveformData();
    miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    miniCtx.beginPath();

    for (let i = 0; i < wave.length; i += 1) {
      const x = (i / (wave.length - 1)) * miniCanvas.width;
      const y = (wave[i] / 255) * miniCanvas.height;
      if (i === 0) {
        miniCtx.moveTo(x, y);
      } else {
        miniCtx.lineTo(x, y);
      }
    }

    miniCtx.strokeStyle = "rgba(137, 255, 188, 0.9)";
    miniCtx.lineWidth = 1.2;
    miniCtx.stroke();

    rafId = requestAnimationFrame(drawMiniAnalyser);
  }

  const unsubscribe = musicManager.subscribe((status) => {
    label.textContent = status.enabled ? "Music On" : "Music";
  });

  drawMiniAnalyser();

  return {
    destroy() {
      unsubscribe();
      cancelAnimationFrame(rafId);
      button.removeEventListener("click", openOverlay);
      button.remove();
    },
  };
}
