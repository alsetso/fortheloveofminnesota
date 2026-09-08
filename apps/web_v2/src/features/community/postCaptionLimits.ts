/** Shared caption limits for compose, edit, and pin-card preview. */
export const POST_CAPTION_MAX = 200;
/** Clamp length before inline "Read more" on the pin card. */
export const POST_CAPTION_PREVIEW = 140;
/**
 * Caption limit for the inline dock composer — intentionally higher than the
 * global `POST_CAPTION_MAX` so the map drop-pin flow has extra breathing room.
 * Also used as the caption limit for MediaCapture when launched from the dock.
 */
export const DOCK_POST_CAPTION_MAX = 240;
