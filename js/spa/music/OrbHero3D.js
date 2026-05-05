// OrbHero3D.js
// The orb is the single persistent visual surface for the entire SPA.
// It morphs between hero states (orb / image / text) using the particle
// transition engine directly on this canvas — no fullscreen overlay needed.
//
// Public API:
//   initOrbHero3D(canvas, manager) → { morphTo(heroSpec): Promise<void>, destroy() }

import { runParticleTransition } from "../particleTransitionEngine.js";

const TRACK_PULL_THRESHOLD_PX = 72;
const VOLUME_DRAG_PX = 120;
const DOMINANCE_GATE_RATIO = 1.35;
const MIN_GESTURE_PX = 12;
const MORPH_DURATION_MS = 700;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createSpherePoints(count, binCount) {  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = i * golden;
    points.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
      bin: i % Math.max(1, binCount),
      deform: 0,
    });
  }

  return points;
}

function averageBand(data, startRatio, endRatio) {
  const start = Math.floor(data.length * startRatio);
  const end = Math.max(start + 1, Math.floor(data.length * endRatio));
  let sum = 0;
  for (let i = start; i < end; i += 1) {
    sum += data[i];
  }
  return sum / (end - start) / 255;
}

// Render one orb frame onto any 2D context.
// points array is mutated (deform smoothing); pass fresh points for static snapshots.
// ptr = { x, y, active } in normalized (-1..1) space.
function drawOrbFrame(ctx, w, h, fft, time, bassS, midS, highS, ptr, points) {
  const cx = w * 0.5;
  const cy = h * 0.52;
  const radius = Math.min(w, h) * 0.32;
  const yaw = time * 0.00022;
  const pitch = Math.sin(time * 0.00011) * 0.35;
  const ptrZ = Math.sqrt(Math.max(0, 1 - ptr.x * ptr.x - ptr.y * ptr.y));
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosX = Math.cos(pitch);
  const sinX = Math.sin(pitch);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(5, 20, 30, 0.95)");
  grad.addColorStop(1, "rgba(2, 8, 13, 0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  points.forEach((point) => {
    const x1 = point.x * cosY - point.z * sinY;
    const z1 = point.x * sinY + point.z * cosY;
    const y2 = point.y * cosX - z1 * sinX;
    const z2 = point.y * sinX + z1 * cosX;
    const x2 = x1;

    const fftValue = (fft[point.bin] || 0) / 255;
    const targetDeform = fftValue * 0.38 + bassS * 0.18 + midS * 0.08;
    point.deform += (targetDeform - point.deform) * 0.18;

    const pointerDot = x2 * ptr.x + y2 * -ptr.y + z2 * ptrZ;
    const pointerPush = Math.max(0, pointerDot) * (ptr.active ? 0.28 : 0.14);
    const displacedRadius = 1 + point.deform + pointerPush;
    const z = z2 * displacedRadius;
    if (z < -0.55) return;

    const perspective = 1 / (2.55 + z);
    const sx = cx + x2 * displacedRadius * radius * perspective * 1.55;
    const sy = cy + y2 * displacedRadius * radius * perspective * 1.55;
    const size = 0.9 + perspective * 2.8 + point.deform * 2.0;
    const alpha = clamp(0.18 + perspective * 0.68 + point.deform * 0.35, 0.1, 1);
    const hue = 188 + fftValue * 28 + highS * 10;
    const light = 55 + perspective * 18 + bassS * 6;

    ctx.fillStyle = `hsla(${hue}, 88%, ${light}%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalCompositeOperation = "screen";
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius * 1.4);
  glow.addColorStop(0, `rgba(111, 231, 255, ${0.12 + bassS * 0.22})`);
  glow.addColorStop(1, "rgba(111, 231, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius * 1.2, radius * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = `rgba(170, 245, 255, ${0.18 + bassS * 0.42})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius * 1.01, radius, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// Build an offscreen canvas snapshot for the destination hero state.
// physW/physH = physical (device) pixels; dpr = devicePixelRatio.
async function buildTargetSnapshot(heroSpec, physW, physH, dpr) {
  const snap = document.createElement("canvas");
  snap.width = physW;
  snap.height = physH;
  const sCtx = snap.getContext("2d");
  const cssW = physW / dpr;
  const cssH = physH / dpr;

  if (heroSpec.kind === "orb") {
    sCtx.save();
    sCtx.scale(dpr, dpr);
    drawOrbFrame(
      sCtx,
      cssW,
      cssH,
      new Uint8Array(128),
      performance.now(),
      0,
      0,
      0,
      { x: 0, y: 0, active: false },
      createSpherePoints(540, 128)
    );
    sCtx.restore();
    return snap;
  }

  if (heroSpec.kind === "image" || heroSpec.kind === "gif") {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        sCtx.fillStyle = "#07141c";
        sCtx.fillRect(0, 0, physW, physH);
        const s = Math.min(physW / img.naturalWidth, physH / img.naturalHeight);
        const iw = img.naturalWidth * s;
        const ih = img.naturalHeight * s;
        sCtx.drawImage(img, (physW - iw) / 2, (physH - ih) / 2, iw, ih);
        resolve(snap);
      };
      img.onerror = () => {
        sCtx.fillStyle = "#07141c";
        sCtx.fillRect(0, 0, physW, physH);
        sCtx.save();
        sCtx.scale(dpr, dpr);
        sCtx.fillStyle = "rgba(100,200,230,0.45)";
        sCtx.font = `${Math.floor(cssH * 0.06)}px sans-serif`;
        sCtx.textAlign = "center";
        sCtx.textBaseline = "middle";
        sCtx.fillText(heroSpec.alt || "?", cssW / 2, cssH / 2);
        sCtx.restore();
        resolve(snap);
      };
      img.src = heroSpec.src;
    });
  }

  if (heroSpec.kind === "text") {
    sCtx.fillStyle = "#07141c";
    sCtx.fillRect(0, 0, physW, physH);
    const fontSize = clamp(cssW * 0.14, 28, 96);
    sCtx.save();
    sCtx.scale(dpr, dpr);
    sCtx.font = `400 ${fontSize}px "Instrument Serif", serif`;
    sCtx.fillStyle = "#e9f9ff";
    sCtx.textAlign = "center";
    sCtx.textBaseline = "middle";
    sCtx.shadowColor = "rgba(20, 183, 255, 0.4)";
    sCtx.shadowBlur = 20;
    sCtx.fillText(heroSpec.text || "", cssW / 2, cssH / 2);
    sCtx.restore();
    return snap;
  }

  sCtx.fillStyle = "#07141c";
  sCtx.fillRect(0, 0, physW, physH);
  return snap;
}

export function initOrbHero3D(canvas, manager) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { morphTo: () => Promise.resolve(), destroy: () => {} };
  }

  let dpr = Math.max(1, window.devicePixelRatio || 1);
  const points = createSpherePoints(540, 128);

  let rafId = 0;
  let bassSmooth = 0;
  let midSmooth = 0;
  let highSmooth = 0;
  let isMorphing = false;

  // Hero mode state
  let mode = "orb"; // "orb" | "image" | "text"
  let activeImage = null; // HTMLImageElement; animated GIFs advance automatically via drawImage
  let activeText = "";

  const pointer = {
    x: 0,
    y: 0,
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
    trackFired: false,
    startVolume: manager.getUserVolume(),
  };

  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(4, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(4, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function safeReleasePointerCapture(pointerId) {
    if (pointerId == null) {
      return;
    }
    if (!canvas.hasPointerCapture(pointerId)) {
      return;
    }
    try {
      canvas.releasePointerCapture(pointerId);
    } catch {
      // Ignore release errors when the element is detached mid-gesture.
    }
  }

  function resetPointerState() {
    safeReleasePointerCapture(pointer.pointerId);
    pointer.active = false;
    pointer.pointerId = null;
    pointer.moved = false;
    pointer.trackFired = false;
  }

  function setPointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
    pointer.x = clamp(nx, -1, 1);
    pointer.y = clamp(ny, -1, 1);
  }

  function onPointerDown(event) {
    pointer.active = true;
    pointer.pointerId = event.pointerId;
    pointer.startX = event.clientX;
    pointer.startY = event.clientY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.moved = false;
    pointer.trackFired = false;
    pointer.startVolume = manager.getUserVolume();
    setPointerFromEvent(event);

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture errors on unsupported inputs.
    }
  }

  function onPointerMove(event) {
    if (!pointer.active || event.pointerId !== pointer.pointerId) {
      return;
    }

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    setPointerFromEvent(event);

    if (absDx > MIN_GESTURE_PX || absDy > MIN_GESTURE_PX) {
      pointer.moved = true;
    }

    const horizontalDominant = absDx > absDy * DOMINANCE_GATE_RATIO;
    const verticalDominant = absDy > absDx * DOMINANCE_GATE_RATIO;

    if (horizontalDominant && !pointer.trackFired && absDx >= TRACK_PULL_THRESHOLD_PX) {
      if (dx < 0) {
        manager.nextTrack();
      } else {
        manager.prevTrack();
      }
      pointer.trackFired = true;
      return;
    }

    if (verticalDominant && absDy >= MIN_GESTURE_PX) {
      const delta = -dy / VOLUME_DRAG_PX;
      manager.setUserVolume(clamp(pointer.startVolume + delta, 0, 1));
    }
  }

  function onPointerUp(event) {
    if (!pointer.active || event.pointerId !== pointer.pointerId) {
      return;
    }

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    const travel = Math.hypot(dx, dy);

    if (!pointer.trackFired && travel < MIN_GESTURE_PX) {
      manager.toggleEnabled();
    }

    resetPointerState();
  }

  function onPointerCancel(event) {
    if (event.pointerId !== pointer.pointerId) {
      return;
    }
    resetPointerState();
  }

  // ── Per-mode render functions ──────────────────────────────────────────────

  function renderImageFrame(w, h) {
    const fft = manager.getAnalyserData();
    bassSmooth += (averageBand(fft, 0, 0.12) - bassSmooth) * 0.14;

    ctx.fillStyle = "#05141d";
    ctx.fillRect(0, 0, w, h);

    if (activeImage && activeImage.complete && activeImage.naturalWidth > 0) {
      const pulse = 1 + bassSmooth * 0.04;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(pulse, pulse);
      ctx.translate(-w / 2, -h / 2);
      const nw = activeImage.naturalWidth;
      const nh = activeImage.naturalHeight;
      const s = Math.min(w / nw, h / nh);
      // drawImage re-reads the current GIF frame each call — free animation
      ctx.drawImage(activeImage, (w - nw * s) / 2, (h - nh * s) / 2, nw * s, nh * s);
      ctx.restore();
    }

    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.45);
    glow.addColorStop(0, `rgba(101, 221, 255, ${bassSmooth * 0.22})`);
    glow.addColorStop(1, "rgba(101, 221, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  function renderTextFrame(w, h) {
    const fft = manager.getAnalyserData();
    bassSmooth += (averageBand(fft, 0, 0.12) - bassSmooth) * 0.14;

    ctx.fillStyle = "#07141c";
    ctx.fillRect(0, 0, w, h);

    const fontSize = clamp(w * 0.14, 28, 96);
    ctx.font = `400 ${fontSize}px "Instrument Serif", serif`;
    ctx.fillStyle = "#e9f9ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = `rgba(20, 183, 255, ${0.12 + bassSmooth * 0.28})`;
    ctx.shadowBlur = 18 + bassSmooth * 24;
    ctx.fillText(activeText, w / 2, h / 2);
    ctx.shadowBlur = 0;

    ctx.globalCompositeOperation = "screen";
    const grad = ctx.createRadialGradient(w / 2, h / 2, fontSize * 0.5, w / 2, h / 2, fontSize * 2.5);
    grad.addColorStop(0, `rgba(101, 221, 255, ${bassSmooth * 0.15})`);
    grad.addColorStop(1, "rgba(101, 221, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Main animation loop ────────────────────────────────────────────────────

  function animate(time) {
    if (isMorphing) return;
    resize();

    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    if (mode === "orb") {
      const fft = manager.getAnalyserData();
      bassSmooth += (averageBand(fft, 0, 0.12) - bassSmooth) * 0.14;
      midSmooth += (averageBand(fft, 0.12, 0.45) - midSmooth) * 0.1;
      highSmooth += (averageBand(fft, 0.45, 0.9) - highSmooth) * 0.08;
      drawOrbFrame(ctx, cssW, cssH, fft, time, bassSmooth, midSmooth, highSmooth, pointer, points);
    } else if (mode === "image") {
      renderImageFrame(cssW, cssH);
    } else if (mode === "text") {
      renderTextFrame(cssW, cssH);
    }

    ctx.restore();
    rafId = requestAnimationFrame(animate);
  }

  // ── Morph ──────────────────────────────────────────────────────────────────
  // Particle-transitions the orb canvas from its current state to a new hero spec.
  // All animation happens on this canvas — no separate fullscreen overlay.

  async function morphTo(heroSpec) {
    if (isMorphing) return;
    isMorphing = true;
    cancelAnimationFrame(rafId);
    rafId = 0;

    resize();
    const physW = canvas.width;
    const physH = canvas.height;
    const cssW = physW / dpr;
    const cssH = physH / dpr;

    // Snapshot current canvas as "from" surface
    const fromSnap = document.createElement("canvas");
    fromSnap.width = physW;
    fromSnap.height = physH;
    fromSnap.getContext("2d").drawImage(canvas, 0, 0);

    // Build "to" surface for the target hero spec
    const toSnap = await buildTargetSnapshot(heroSpec, physW, physH, dpr);

    // Run particles on THIS canvas using canvas-local coordinates (x=0, y=0)
    const surface = { width: cssW, height: cssH, x: 0, y: 0 };
    await runParticleTransition({
      canvas,
      fromSurface: { ...surface, canvas: fromSnap },
      toSurface: { ...surface, canvas: toSnap },
      duration: MORPH_DURATION_MS,
    });

    // Switch render mode and start loop
    if (heroSpec.kind === "orb") {
      mode = "orb";
      activeImage = null;
      activeText = "";
    } else if (heroSpec.kind === "image" || heroSpec.kind === "gif") {
      mode = "image";
      activeText = "";
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = heroSpec.src;
      activeImage = img;
    } else if (heroSpec.kind === "text") {
      mode = "text";
      activeImage = null;
      activeText = heroSpec.text || "";
    }

    isMorphing = false;
    rafId = requestAnimationFrame(animate);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("lostpointercapture", resetPointerState);

  resize();
  rafId = requestAnimationFrame(animate);

  return {
    morphTo,
    destroy() {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("lostpointercapture", resetPointerState);
      resetPointerState();
    },
  };
}
