/**
 * Lightweight grid posters — never leave a full `<video>` in Recents tiles.
 */

const THUMB_MAX_EDGE = 360;
const THUMB_JPEG_QUALITY = 0.72;
/** Keep localStorage manifest small. */
const THUMB_MAX_DATA_URL_CHARS = 120_000;

function canvasToThumbDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    const url = canvas.toDataURL('image/jpeg', THUMB_JPEG_QUALITY);
    if (!url.startsWith('data:image/jpeg') || url.length > THUMB_MAX_DATA_URL_CHARS) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
): void {
  const scale = Math.max(THUMB_MAX_EDGE / sw, THUMB_MAX_EDGE / sh);
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const canvas = ctx.canvas;
  canvas.width = Math.min(THUMB_MAX_EDGE, dw);
  canvas.height = Math.min(THUMB_MAX_EDGE, dh);
  const ox = (canvas.width - dw) / 2;
  const oy = (canvas.height - dh) / 2;
  ctx.drawImage(source, ox, oy, dw, dh);
}

/** Downscale a photo File for grid tiles (optional — remote images are usually fine). */
export async function makeImageThumbFromFile(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image decode failed'));
      el.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    drawCover(ctx, img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    return canvasToThumbDataUrl(canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export type VideoPosterResult = {
  thumbUrl: string | null;
  durationSec: number | null;
};

/**
 * Grab a poster frame from a local File or remote/blob URL.
 * Used at commit time and as a one-shot lazy fallback for older Recents rows.
 */
export async function makeVideoPoster(
  source: File | string,
  seekSeconds = 0.15,
): Promise<VideoPosterResult> {
  const objectUrl = typeof source === 'string' ? source : URL.createObjectURL(source);
  const shouldRevoke = typeof source !== 'string';

  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('video decode failed'));
      video.src = objectUrl;
      video.load();
    });

    const durationSec =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;

    const target = durationSec
      ? Math.min(Math.max(0, seekSeconds), Math.max(0, durationSec - 0.05))
      : 0;

    if (target > 0) {
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        try {
          video.currentTime = target;
        } catch {
          resolve();
        }
      });
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      return { thumbUrl: null, durationSec };
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { thumbUrl: null, durationSec };
    drawCover(ctx, video, vw, vh);
    return { thumbUrl: canvasToThumbDataUrl(canvas), durationSec };
  } catch {
    return { thumbUrl: null, durationSec: null };
  } finally {
    if (shouldRevoke) URL.revokeObjectURL(objectUrl);
  }
}

/** Build a grid thumb for any compose file. */
export async function makeMediaThumbFromFile(
  file: File,
): Promise<{ thumbUrl: string | null; durationSec: number | null }> {
  if (file.type.startsWith('video/')) {
    return makeVideoPoster(file);
  }
  if (file.type.startsWith('image/')) {
    return { thumbUrl: await makeImageThumbFromFile(file), durationSec: null };
  }
  return { thumbUrl: null, durationSec: null };
}
