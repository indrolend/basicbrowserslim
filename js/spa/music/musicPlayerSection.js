import { initOrbHero3D } from "./OrbHero3D.js";

export function renderMusicPlayerSection({ host, musicManager }) {
  const root = document.createElement("section");
  root.className = "music-player";

  const nowPlaying = document.createElement("p");
  nowPlaying.textContent = "";

  const controls = document.createElement("div");
  controls.className = "row";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.textContent = "Prev";

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.textContent = "Play";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.textContent = "Next";

  controls.append(prevBtn, playBtn, nextBtn);

  const volumeRow = document.createElement("div");
  volumeRow.className = "row";

  const volumeLabel = document.createElement("label");
  volumeLabel.textContent = "Volume";

  const volumeInput = document.createElement("input");
  volumeInput.type = "range";
  volumeInput.min = "0";
  volumeInput.max = "1";
  volumeInput.step = "0.01";

  volumeRow.append(volumeLabel, volumeInput);

  const orbWrap = document.createElement("div");
  orbWrap.className = "orb-wrap";

  const orbCanvas = document.createElement("canvas");
  orbWrap.appendChild(orbCanvas);

  root.append(nowPlaying, controls, volumeRow, orbWrap);
  host.replaceChildren(root);

  const orb = initOrbHero3D(orbCanvas, musicManager);

  const sync = (status) => {
    const data = status || musicManager.getStatus();
    playBtn.textContent = data.enabled ? "Pause" : "Play";
    nowPlaying.textContent = `Now playing: ${data.track.title}`;
    volumeInput.value = String(data.volume);
  };

  const onPrev = () => musicManager.prevTrack();
  const onPlay = () => musicManager.toggleEnabled();
  const onNext = () => musicManager.nextTrack();
  const onVolume = () => {
    musicManager.setUserVolume(Number(volumeInput.value));
  };

  prevBtn.addEventListener("click", onPrev);
  playBtn.addEventListener("click", onPlay);
  nextBtn.addEventListener("click", onNext);
  volumeInput.addEventListener("input", onVolume);

  const unsubscribe = musicManager.subscribe(sync);
  sync();

  return () => {
    unsubscribe();
    prevBtn.removeEventListener("click", onPrev);
    playBtn.removeEventListener("click", onPlay);
    nextBtn.removeEventListener("click", onNext);
    volumeInput.removeEventListener("input", onVolume);
    orb.destroy();
  };
}
