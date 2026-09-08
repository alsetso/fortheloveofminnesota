/**
 * Bake text overlay layers into a photo via offscreen canvas.
 * Video burn-in is intentionally out of scope — see VideoTextOverlays + post meta.
 *
 * TODO(ffmpeg): server-side video text burn-in for exported/shared clips.
 */

import {
  TEXT_OVERLAY_BASE_PX,
  type TextLayerData,
} from '@/components/media/capture/TextOverlay/types';

/** Preview card width used when placing CSS text — keeps canvas type scale matched. */
const REFERENCE_PREVIEW_WIDTH_PX = 390;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image for flatten'));
    img.src = src;
  });
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayerData,
  canvasW: number,
  canvasH: number,
) {
  const content = layer.content.trim();
  if (!content) return;

  const scaleFactor = canvasW / REFERENCE_PREVIEW_WIDTH_PX;
  const fontSize = TEXT_OVERLAY_BASE_PX * layer.scale * scaleFactor;
  const fontWeight = layer.bold ? 700 : 500;
  ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxTextWidth = canvasW * 0.85;
  const lines = wrapLines(ctx, content, maxTextWidth);
  const lineHeight = fontSize * 1.15;
  const textBlockH = lines.length * lineHeight;
  let maxLineW = 0;
  for (const line of lines) {
    maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
  }

  const cx = layer.x * canvasW;
  const cy = layer.y * canvasH;
  const padX = fontSize * 0.45;
  const padY = fontSize * 0.28;
  const chipW = maxLineW + padX * 2;
  const chipH = textBlockH + padY * 2;
  const chipX = cx - chipW / 2;
  const chipY = cy - chipH / 2;

  const isLight = layer.color === '#FFFFFF' || layer.color === '#FFCC00';

  if (layer.background === 'solid') {
    ctx.fillStyle = layer.color;
    roundRect(ctx, chipX, chipY, chipW, chipH, fontSize * 0.35);
    ctx.fill();
    ctx.fillStyle = isLight ? '#111111' : '#FFFFFF';
  } else if (layer.background === 'glass') {
    // Approximate glass — real blur isn't available on 2d canvas without filters.
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    roundRect(ctx, chipX, chipY, chipW, chipH, fontSize * 0.35);
    ctx.fill();
    ctx.fillStyle = layer.color;
  } else {
    ctx.fillStyle = layer.color;
  }

  const startY = cy - textBlockH / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, cx, startY + i * lineHeight);
  }
}

/**
 * Draw `baseImageUrl` + text layers into a JPEG File.
 * Layers are consumed here — caller should not keep them for photos.
 */
export async function flattenTextOntoImage(
  baseImageUrl: string,
  layers: readonly TextLayerData[],
): Promise<File> {
  const img = await loadImage(baseImageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error('Invalid image size');
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const layer of layers) {
    drawLayer(ctx, layer, canvas.width, canvas.height);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  );
  if (!blob) throw new Error('Could not flatten image');

  return new File([blob], `story-${Date.now()}.jpg`, { type: 'image/jpeg' });
}
