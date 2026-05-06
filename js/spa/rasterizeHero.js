// Rasterize a hero (GIF/image element or text) to a canvas for transition engine use
// Usage: rasterizeHero({type: 'gif', src: '...'})
//        rasterizeHero({type: 'element', element: imgEl})
//        rasterizeHero({type: 'textElement', element: textEl})

const SPA_DEBUG =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('spa_debug') === '1';
function spaDebug(...args) {
  if (SPA_DEBUG) console.debug(...args);
}

const HERO_CANVAS_WIDTH = 320;
const HERO_CANVAS_HEIGHT = 320;
const TEXT_RASTER_CANVAS_PADDING = 32;

function getSizedTextCanvas(textEl) {
  const rect = textEl.getBoundingClientRect();
  const width = Math.max(
    HERO_CANVAS_WIDTH,
    Math.ceil(rect.width || 0) + (TEXT_RASTER_CANVAS_PADDING * 2)
  );
  const height = Math.max(
    HERO_CANVAS_HEIGHT,
    Math.ceil(rect.height || 0) + (TEXT_RASTER_CANVAS_PADDING * 2)
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getFallbackTextCanvas(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSizePx = 40;
  ctx.font = `700 ${fontSizePx}px SF Mono, Menlo, Monaco, Consolas, monospace`;
  const measuredWidth = ctx.measureText(text || '').width;
  canvas.width = Math.max(
    HERO_CANVAS_WIDTH,
    Math.ceil(measuredWidth) + (TEXT_RASTER_CANVAS_PADDING * 2)
  );
  canvas.height = HERO_CANVAS_HEIGHT;
  return canvas;
}

function parsePixelValue(value, fallback = 0) {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function drawTextWithLetterSpacing(ctx, text, x, y, letterSpacingPx) {
  if (!letterSpacingPx) {
    ctx.fillText(text, x, y);
    return;
  }
  const chars = [...text];
  const fullWidth =
    chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) +
    Math.max(0, chars.length - 1) * letterSpacingPx;
  let drawX = x - (fullWidth / 2);
  for (const ch of chars) {
    ctx.fillText(ch, drawX, y);
    drawX += ctx.measureText(ch).width + letterSpacingPx;
  }
}

function wrapTextLines(ctx, text, maxWidth, letterSpacingPx) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let currentLine = words[0];
  const measure = (value) => {
    const base = ctx.measureText(value).width;
    return base + Math.max(0, value.length - 1) * letterSpacingPx;
  };
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${currentLine} ${words[i]}`;
    if (measure(candidate) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

function copyComputedStyle(sourceEl, targetEl) {
  const computed = window.getComputedStyle(sourceEl);
  for (let i = 0; i < computed.length; i += 1) {
    const prop = computed[i];
    targetEl.style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop));
  }
}

function inlineComputedStyles(sourceEl, cloneEl) {
  copyComputedStyle(sourceEl, cloneEl);
  const sourceChildren = sourceEl.children;
  const cloneChildren = cloneEl.children;
  const childCount = Math.min(sourceChildren.length, cloneChildren.length);
  for (let i = 0; i < childCount; i += 1) {
    const sourceChild = sourceChildren[i];
    const cloneChild = cloneChildren[i];
    if (sourceChild instanceof window.HTMLElement && cloneChild instanceof window.HTMLElement) {
      inlineComputedStyles(sourceChild, cloneChild);
    }
  }
}

function heroElementHasCanvas(heroRoot) {
  return heroRoot instanceof window.HTMLElement && !!heroRoot.querySelector('canvas');
}

function compositeCanvasChildren(ctx, targetCanvas, textEl) {
  const canvasEls = textEl.querySelectorAll('canvas');
  if (!canvasEls.length) return;
  const parentRect = textEl.getBoundingClientRect();
  const parentW = Math.max(1, Math.ceil(parentRect.width));
  const parentH = Math.max(1, Math.ceil(parentRect.height));
  canvasEls.forEach((srcCanvas) => {
    if (!srcCanvas.width || !srcCanvas.height) return;
    const srcRect = srcCanvas.getBoundingClientRect();
    const relLeft = srcRect.left - parentRect.left;
    const relTop  = srcRect.top  - parentRect.top;
    const dstX = (targetCanvas.width  - parentW) / 2 + relLeft;
    const dstY = (targetCanvas.height - parentH) / 2 + relTop;
    ctx.drawImage(srcCanvas, dstX, dstY, srcRect.width, srcRect.height);
  });
}

function drawTextElementViaSvg(ctx, canvas, textEl, onDone, onError) {
  const rect = textEl.getBoundingClientRect();
  const width  = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));

  const clone = textEl.cloneNode(true);
  if (!(clone instanceof window.HTMLElement)) {
    onError(new Error('Failed to clone text element'));
    return;
  }

  inlineComputedStyles(textEl, clone);
  clone.style.margin   = '0';
  clone.style.width    = `${width}px`;
  // Probe elements use off-screen absolute positioning to hide them from view.
  // Reset to relative so SVG foreignObject renders at the origin.
  clone.style.position   = 'relative';
  clone.style.left       = 'auto';
  clone.style.top        = 'auto';
  clone.style.right      = 'auto';
  clone.style.bottom     = 'auto';
  // inlineComputedStyles copies visibility/opacity from the source element, which
  // may be a probe with visibility:hidden. Reset them so SVG foreignObject renders
  // the text visibly regardless of how the source was hidden.
  clone.style.visibility = 'visible';
  clone.style.opacity    = '1';
  for (const child of clone.querySelectorAll('*')) {
    child.style.visibility = 'visible';
    child.style.opacity    = '1';
  }

  const serializer = new window.XMLSerializer();
  const escaped = serializer.serializeToString(clone).replace(/&nbsp;/g, '&#160;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject x="0" y="0" width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;">${escaped}</div>
      </foreignObject>
    </svg>`;

  const img = new window.Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    // Composite any live canvas children (e.g. the asymptote animation) behind
    // the text. destination-over places new pixels only where alpha is zero,
    // so the already-drawn text stays on top.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    compositeCanvasChildren(ctx, canvas, textEl);
    ctx.restore();
    onDone();
  };
  img.onerror = () => onError(new Error('Failed to rasterize text element via SVG'));
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function drawTextElement(ctx, canvas, textEl) {
  const style = window.getComputedStyle(textEl);
  const rect = textEl.getBoundingClientRect();

  const fontSizePx = parsePixelValue(style.fontSize, 40);
  const lineHeightPx = style.lineHeight === 'normal'
    ? fontSizePx * 1.2
    : parsePixelValue(style.lineHeight, fontSizePx * 1.2);
  const letterSpacingPx = parsePixelValue(style.letterSpacing, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = style.font || `${style.fontWeight || '700'} ${fontSizePx}px ${style.fontFamily || 'monospace'}`;
  ctx.fillStyle = style.color || '#5ee87d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const sourceText = textEl.textContent || '';
  const renderText = (style.textTransform === 'uppercase') ? sourceText.toUpperCase() : sourceText;
  const maxWidth = Math.max(32, Math.min(rect.width || canvas.width * 0.9, canvas.width * 0.95));
  const lines = wrapTextLines(ctx, renderText, maxWidth, letterSpacingPx);

  const blockHeight = lines.length * lineHeightPx;
  let y = (canvas.height / 2) - (blockHeight / 2) + fontSizePx;

  for (const line of lines) {
    drawTextWithLetterSpacing(ctx, line, canvas.width / 2, y, letterSpacingPx);
    y += lineHeightPx;
  }
}

// Utility: Crop a canvas to its non-transparent bounding box
function cropToContent(canvas, padding = 0) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 32) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) {
    return { canvas, offsetX: 0, offsetY: 0, width, height, hasVisibleContent: false };
  }
  const extra = Math.max(0, Math.floor(padding));
  const paddedMinX = Math.max(0, minX - extra);
  const paddedMinY = Math.max(0, minY - extra);
  const paddedMaxX = Math.min(width - 1, maxX + extra);
  const paddedMaxY = Math.min(height - 1, maxY + extra);
  const cropW = paddedMaxX - paddedMinX + 1;
  const cropH = paddedMaxY - paddedMinY + 1;
  const cropped = document.createElement('canvas');
  cropped.width = cropW;
  cropped.height = cropH;
  cropped.getContext('2d').drawImage(canvas, paddedMinX, paddedMinY, cropW, cropH, 0, 0, cropW, cropH);
  return { canvas: cropped, offsetX: paddedMinX, offsetY: paddedMinY, width: cropW, height: cropH, hasVisibleContent: true };
}

/**
 * Rasterizes a hero asset (GIF, image element, or text) into a transition surface object.
 * @param {Object} hero - { type: 'gif'|'element'|'text'|'textElement', src?, element?, text? }
 * @returns {Promise<{canvas, offsetX, offsetY, width, height, hasVisibleContent}>}
 */
export function rasterizeHero(hero) {
  return new Promise((resolve, reject) => {
    const canvas =
      hero.type === 'textElement' && hero.element instanceof window.HTMLElement
        ? getSizedTextCanvas(hero.element)
        : hero.type === 'text'
          ? getFallbackTextCanvas(hero.text)
          : document.createElement('canvas');
    if (canvas.width < HERO_CANVAS_WIDTH) canvas.width = HERO_CANVAS_WIDTH;
    if (canvas.height < HERO_CANVAS_HEIGHT) canvas.height = HERO_CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    function finish({ padding = 0, debugLabel = '', skipCrop = false } = {}) {
      // Procedural canvas heroes: keep full buffer to match on-screen layout.
      if (skipCrop) {
        const surface = {
          canvas,
          offsetX: 0,
          offsetY: 0,
          width: canvas.width,
          height: canvas.height,
          hasVisibleContent: true,
        };
        if (debugLabel) {
          spaDebug(`[rasterizeHero] ${debugLabel} skipCrop full=${surface.width}x${surface.height}`);
        }
        resolve(surface);
        return;
      }
      const cropped = cropToContent(canvas, padding);
      if (debugLabel) {
        spaDebug(
          `[rasterizeHero] ${debugLabel} visible=${cropped.hasVisibleContent} ` +
          `size=${cropped.width}x${cropped.height} offset=(${cropped.offsetX},${cropped.offsetY})`
        );
      }
      resolve(cropped);
    }

    function drawCenteredImage(img, sourceWidth = img.width, sourceHeight = img.height, finishOptions = {}) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
      const w = sourceWidth * scale;
      const h = sourceHeight * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      finish(finishOptions);
    }

    if (hero.type === 'gif') {
      spaDebug(`[rasterizeHero] branch=gif src=${hero.src}`);
      const img = new window.Image();
      img.onload = function() {
        drawCenteredImage(img, img.width, img.height, {
          debugLabel: 'gif(full-frame)',
          skipCrop: true,
        });
      };
      img.onerror = function() {
        reject(new Error('Failed to load GIF'));
      };
      img.src = hero.src;
    } else if (hero.type === 'element') {
      const sourceEl = hero.element;
      if (sourceEl instanceof window.HTMLCanvasElement) {
        const srcW = sourceEl.width;
        const srcH = sourceEl.height;
        if (!srcW || !srcH) {
          reject(new Error('Canvas element not ready'));
          return;
        }
        const preserveFullCanvasFrame = true;
        spaDebug(
          `[rasterizeHero] branch=element live=true canvas=${srcW}x${srcH} fullFrame=${preserveFullCanvasFrame}`
        );
        drawCenteredImage(sourceEl, srcW, srcH, {
          debugLabel: 'element(canvas-full-frame)',
          skipCrop: preserveFullCanvasFrame,
        });
        return;
      }

      const imgEl = sourceEl;
      if (!(imgEl instanceof window.HTMLImageElement)) {
        reject(new Error('Invalid image element'));
        return;
      }
      function captureImgFrame() {
        const src = imgEl.currentSrc || imgEl.src || '';
        const isGifSource = /\.gif(?:[?#]|$)/i.test(src);
        spaDebug(
          `[rasterizeHero] branch=element live=true gif=${isGifSource} ` +
          `complete=${imgEl.complete} natural=${imgEl.naturalWidth}x${imgEl.naturalHeight}`
        );
        // Use skipCrop:true for GIFs so the full 320×320 frame is preserved;
        // cropping per-frame shifts the bounding box as transparent regions change.
        drawCenteredImage(imgEl, imgEl.width || imgEl.naturalWidth, imgEl.height || imgEl.naturalHeight, {
          debugLabel: isGifSource ? 'element(gif-frame)' : 'element(img)',
          skipCrop: isGifSource,
        });
        spaDebug(`[rasterizeHero] element capture drawn src=${src}`);
      }
      if (!imgEl.complete || !imgEl.naturalWidth || !imgEl.naturalHeight) {
        // Image not yet loaded (e.g. offscreen probe for destination hero).
        imgEl.addEventListener('load',  captureImgFrame,                                { once: true });
        imgEl.addEventListener('error', () => reject(new Error('Image element failed to load')), { once: true });
      } else {
        captureImgFrame();
      }
    } else if (hero.type === 'textElement') {
      const textEl = hero.element;
      if (!(textEl instanceof window.HTMLElement)) {
        reject(new Error('Invalid text element'));
        return;
      }

      const skipCropForCanvasHero = heroElementHasCanvas(textEl);

      drawTextElementViaSvg(
        ctx,
        canvas,
        textEl,
        () => {
          spaDebug('[rasterizeHero] textElement SVG rasterization succeeded');
          finish({
            padding: 14,
            debugLabel: 'textElement(svg)',
            skipCrop: skipCropForCanvasHero,
          });
        },
        () => {
          spaDebug('[rasterizeHero] textElement SVG rasterization failed; using canvas fallback');
          drawTextElement(ctx, canvas, textEl);
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          compositeCanvasChildren(ctx, canvas, textEl);
          ctx.restore();
          finish({
            padding: 14,
            debugLabel: 'textElement(fallback)',
            skipCrop: skipCropForCanvasHero,
          });
        }
      );
    } else if (hero.type === 'text') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '700 40px SF Mono, Menlo, Monaco, Consolas, monospace';
      ctx.fillStyle = '#5ee87d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hero.text, canvas.width / 2, canvas.height / 2);
      finish();
    } else {
      reject(new Error('Unknown hero type'));
    }
  });
}
