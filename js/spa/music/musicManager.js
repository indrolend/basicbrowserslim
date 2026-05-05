const DEFAULT_TRACKS = [
  {
    title: "SoundHelix Song 1",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    title: "SoundHelix Song 2",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    title: "SoundHelix Song 3",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrapIndex(index, length) {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}

export function createMusicManager() {
  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";
  audio.volume = 0.65;

  const tracks = DEFAULT_TRACKS;
  let trackIndex = 0;
  let enabled = false;

  let audioContext = null;
  let analyser = null;
  let sourceNode = null;

  const listeners = new Set();

  function emit() {
    const payload = getStatus();
    listeners.forEach((listener) => listener(payload));
  }

  function setTrack(index) {
    trackIndex = wrapIndex(index, tracks.length);
    audio.src = tracks[trackIndex].src;
    if (enabled) {
      audio
        .play()
        .catch(() => {
          enabled = false;
          emit();
        });
    }
    emit();
  }

  function ensureAudioGraph() {
    if (!audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      audioContext = Ctor ? new Ctor() : null;
    }

    if (audioContext && !sourceNode) {
      sourceNode = audioContext.createMediaElementSource(audio);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      sourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
    }
  }

  async function unlock() {
    ensureAudioGraph();
    if (audioContext && audioContext.state === "suspended") {
      await audioContext.resume();
    }
  }

  async function play() {
    await unlock();
    enabled = true;
    try {
      await audio.play();
    } catch {
      enabled = false;
    }
    emit();
  }

  function pause() {
    enabled = false;
    audio.pause();
    emit();
  }

  function toggleEnabled() {
    if (enabled) {
      pause();
      return;
    }
    play();
  }

  function nextTrack() {
    setTrack(trackIndex + 1);
  }

  function prevTrack() {
    setTrack(trackIndex - 1);
  }

  function setUserVolume(value) {
    const clamped = clamp(value, 0, 1);
    audio.volume = clamped;
    emit();
  }

  function getUserVolume() {
    return audio.volume;
  }

  function getAnalyserData() {
    if (!analyser) {
      return new Uint8Array(64);
    }

    const bins = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(bins);
    return bins;
  }

  function getWaveformData() {
    if (!analyser) {
      return new Uint8Array(64);
    }

    const wave = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(wave);
    return wave;
  }

  function getStatus() {
    return {
      enabled,
      volume: audio.volume,
      trackIndex,
      track: tracks[trackIndex],
      tracks,
    };
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  audio.addEventListener("ended", () => {
    nextTrack();
  });

  setTrack(0);

  return {
    unlock,
    play,
    pause,
    toggleEnabled,
    nextTrack,
    prevTrack,
    setUserVolume,
    getUserVolume,
    getAnalyserData,
    getWaveformData,
    getStatus,
    subscribe,
  };
}