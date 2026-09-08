export type TextLayerBackground = 'none' | 'solid' | 'glass';

/**
 * Positioned text overlay on capture preview.
 * x/y are normalized 0–1 centers relative to the media frame.
 */
export type TextLayerData = {
  id: string;
  content: string;
  x: number;
  y: number;
  scale: number;
  color: string;
  background: TextLayerBackground;
  bold: boolean;
};

export const TEXT_OVERLAY_COLORS = [
  '#FFFFFF',
  '#000000',
  '#FF3B30',
  '#FFCC00',
  '#34C759',
  '#007AFF',
] as const;

export const TEXT_OVERLAY_BASE_PX = 28;
export const TEXT_OVERLAY_MIN_SCALE = 0.55;
export const TEXT_OVERLAY_MAX_SCALE = 2.8;

export function newTextLayerId(): string {
  return `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTextLayerDraft(
  partial?: Partial<TextLayerData>,
): TextLayerData {
  return {
    id: newTextLayerId(),
    content: '',
    x: 0.5,
    y: 0.45,
    scale: 1,
    color: TEXT_OVERLAY_COLORS[0],
    background: 'none',
    bold: true,
    ...partial,
  };
}
