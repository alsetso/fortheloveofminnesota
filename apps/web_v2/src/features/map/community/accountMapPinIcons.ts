/**
 * Circular account-avatar icons for community map pins (Mapbox symbol layer).
 * Avatar / silhouette only — soft drop shadow, 2px transparent ring (no chrome).
 *
 * Important: never register the silhouette under a per-account image id.
 * `styleimagemissing` may fire before async avatar loads finish — only seed
 * the shared fallback there so real photos can still `addImage` / `updateImage`.
 */

export const ACCOUNT_PIN_ICON_SIZE = 48;
/** Transparent pad around the disc so the drop shadow isn’t clipped. */
const ACCOUNT_PIN_SHADOW_PAD = 5;
const ACCOUNT_PIN_BORDER_PX = 2;

export const MAP_ACCOUNT_PIN_FALLBACK_ID = 'map-account-pin-fallback';

export function accountMapPinImageId(accountId: string): string {
  return `map-account-icon-${accountId.replace(/[^a-zA-Z0-9-]/g, '_')}`;
}

export function resolveAccountMapPinIconImageId(
  accountId: string | null | undefined,
  accountImageUrl: string | null | undefined,
): string {
  if (accountId && accountImageUrl) {
    return accountMapPinImageId(String(accountId));
  }
  return MAP_ACCOUNT_PIN_FALLBACK_ID;
}

export function buildAccountMapPinIconExpression(): [
  'coalesce',
  ['get', 'icon_image_id'],
  string,
] {
  return ['coalesce', ['get', 'icon_image_id'], MAP_ACCOUNT_PIN_FALLBACK_ID];
}

function canvasSize(discSize: number): number {
  return discSize + ACCOUNT_PIN_SHADOW_PAD * 2;
}

function drawSoftShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fill();
  ctx.restore();
}

function drawFallbackPerson(discSize: number = ACCOUNT_PIN_ICON_SIZE): ImageData | null {
  const size = canvasSize(discSize);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = discSize / 2 - ACCOUNT_PIN_BORDER_PX;

  ctx.clearRect(0, 0, size, size);
  drawSoftShadow(ctx, cx, cy + 0.5, radius);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#2a6f97';
  ctx.fill();

  // 2px fully transparent border — keeps the disc inset from the shadow pad.
  ctx.beginPath();
  ctx.arc(cx, cy, radius + ACCOUNT_PIN_BORDER_PX / 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0)';
  ctx.lineWidth = ACCOUNT_PIN_BORDER_PX;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy - discSize * 0.12, discSize * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + discSize * 0.22, discSize * 0.22, discSize * 0.18, 0, Math.PI, 0, true);
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

export async function renderAccountImageMapPinIconImageData(
  imageUrl: string,
  discSize: number = ACCOUNT_PIN_ICON_SIZE,
): Promise<ImageData | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('avatar load failed'));
      img.src = imageUrl;
    });

    const size = canvasSize(discSize);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const cx = size / 2;
    const cy = size / 2;
    const radius = discSize / 2 - ACCOUNT_PIN_BORDER_PX;
    const pad = ACCOUNT_PIN_SHADOW_PAD + ACCOUNT_PIN_BORDER_PX;

    ctx.clearRect(0, 0, size, size);
    drawSoftShadow(ctx, cx, cy + 0.5, radius);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    const destSize = discSize - ACCOUNT_PIN_BORDER_PX * 2;
    const imgAspect = img.width / img.height;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;
    if (imgAspect > 1) {
      sw = sh;
      sx = (img.width - sw) / 2;
    } else if (imgAspect < 1) {
      sh = sw;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, pad, pad, destSize, destSize);
    ctx.restore();

    // Fully transparent 2px ring — no visible chrome.
    ctx.beginPath();
    ctx.arc(cx, cy, radius + ACCOUNT_PIN_BORDER_PX / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0)';
    ctx.lineWidth = ACCOUNT_PIN_BORDER_PX;
    ctx.stroke();

    return ctx.getImageData(0, 0, size, size);
  } catch {
    return null;
  }
}

type MapboxIconRegistry = {
  hasImage: (id: string) => boolean;
  addImage: (id: string, data: ImageData, opts?: { pixelRatio: number }) => void;
  updateImage?: (id: string, data: ImageData) => void;
  removeImage?: (id: string) => void;
};

function putAccountMapPinImage(
  map: MapboxIconRegistry,
  imageId: string,
  data: ImageData,
): void {
  try {
    if (map.hasImage(imageId)) {
      if (typeof map.updateImage === 'function') {
        map.updateImage(imageId, data);
        return;
      }
      map.removeImage?.(imageId);
    }
    map.addImage(imageId, data, { pixelRatio: 2 });
  } catch {
    /* duplicate / mid-reload */
  }
}

export function ensureAccountMapPinFallback(map: MapboxIconRegistry): void {
  try {
    if (map.hasImage(MAP_ACCOUNT_PIN_FALLBACK_ID)) return;
  } catch {
    return;
  }
  const fallback = drawFallbackPerson(ACCOUNT_PIN_ICON_SIZE);
  if (!fallback) return;
  try {
    map.addImage(MAP_ACCOUNT_PIN_FALLBACK_ID, fallback, { pixelRatio: 2 });
  } catch {
    /* duplicate */
  }
}

export async function registerAccountMapPinIcons(
  map: MapboxIconRegistry,
  features: Array<{ properties?: Record<string, unknown> | null }>,
): Promise<void> {
  ensureAccountMapPinFallback(map);

  const accounts = new Map<string, string>();
  for (const feature of features) {
    const accountId = feature.properties?.account_id;
    const imageUrl = feature.properties?.account_image_url;
    if (typeof accountId !== 'string' || !accountId) continue;
    if (typeof imageUrl !== 'string' || !imageUrl.trim()) continue;
    if (!accounts.has(accountId)) accounts.set(accountId, imageUrl);
  }

  await Promise.all(
    [...accounts.entries()].map(async ([accountId, imageUrl]) => {
      const imageId = accountMapPinImageId(accountId);
      const imageData = await renderAccountImageMapPinIconImageData(imageUrl);
      // Prefer real avatar; on load failure leave id unregistered so the
      // symbol expression falls through to the shared silhouette via coalesce
      // only when icon_image_id is missing — here icon_image_id is set, so
      // register a silhouette under the account id only as last resort when
      // the photo fails (not via styleimagemissing).
      const data = imageData ?? drawFallbackPerson(ACCOUNT_PIN_ICON_SIZE);
      if (!data) return;
      putAccountMapPinImage(map, imageId, data);
    }),
  );
}

/**
 * Only seed the shared fallback. Never claim `map-account-icon-*` ids —
 * that permanently blocked real avatars when hasImage short-circuited.
 */
export function createAccountMapPinMissingImageHandler(
  map: MapboxIconRegistry,
): (e: { id?: string }) => void {
  return (e) => {
    const id = e?.id ?? '';
    if (id !== MAP_ACCOUNT_PIN_FALLBACK_ID) return;
    ensureAccountMapPinFallback(map);
  };
}
