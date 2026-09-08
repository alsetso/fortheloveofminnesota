'use client';

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  TEXT_OVERLAY_BASE_PX,
  TEXT_OVERLAY_MAX_SCALE,
  TEXT_OVERLAY_MIN_SCALE,
  type TextLayerData,
} from '@/components/media/capture/TextOverlay/types';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function layerVisuals(layer: TextLayerData): {
  style: CSSProperties;
  className: string;
} {
  const isLight = layer.color === '#FFFFFF' || layer.color === '#FFCC00';
  if (layer.background === 'solid') {
    return {
      className: '',
      style: {
        backgroundColor: layer.color,
        color: isLight ? '#111111' : '#FFFFFF',
      },
    };
  }
  if (layer.background === 'glass') {
    return {
      className: 'backdrop-blur-md',
      style: {
        backgroundColor: 'rgba(0,0,0,0.42)',
        color: layer.color,
      },
    };
  }
  return {
    className: 'bg-transparent',
    style: { color: layer.color },
  };
}

export type TextLayerProps = {
  layer: TextLayerData;
  /** When true, layer is being edited in the modal — hide the placed instance. */
  hidden?: boolean;
  /**
   * Drag / pinch / tap-to-edit. Off for video playback overlays
   * (CSS-positioned only until ffmpeg burn-in exists).
   */
  interactive?: boolean;
  onChange?: (next: TextLayerData) => void;
  onEdit?: (layer: TextLayerData) => void;
};

/**
 * Single placed text instance — drag to move, pinch to resize, tap to re-edit.
 * Same component sits over <video> at playback with `interactive={false}`.
 */
export default function TextLayer({
  layer,
  hidden = false,
  interactive = true,
  onChange,
  onEdit,
}: TextLayerProps) {
  const rootRef = useRef<HTMLElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragOriginRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    layerX: number;
    layerY: number;
    moved: boolean;
  } | null>(null);
  const pinchOriginRef = useRef<{
    startDist: number;
    startScale: number;
  } | null>(null);

  if (hidden || !layer.content.trim()) return null;

  const visuals = layerVisuals(layer);
  const fontSize = TEXT_OVERLAY_BASE_PX * layer.scale;
  const style: CSSProperties = {
    left: `${layer.x * 100}%`,
    top: `${layer.y * 100}%`,
    transform: 'translate(-50%, -50%)',
    fontSize,
    fontWeight: layer.bold ? 700 : 500,
    ...visuals.style,
  };
  const className = `absolute z-10 max-w-[85%] select-none whitespace-pre-wrap break-words rounded-xl px-3 py-1.5 text-center leading-tight ${visuals.className}`;

  if (!interactive) {
    return (
      <div className={`pointer-events-none ${className}`} style={style}>
        {layer.content}
      </div>
    );
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      dragOriginRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        layerX: layer.x,
        layerY: layer.y,
        moved: false,
      };
      pinchOriginRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      pinchOriginRef.current = {
        startDist: distance(pts[0]!, pts[1]!),
        startScale: layer.scale,
      };
      dragOriginRef.current = null;
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (pointersRef.current.size >= 2 && pinchOriginRef.current) {
      const pts = [...pointersRef.current.values()];
      const dist = distance(pts[0]!, pts[1]!);
      if (pinchOriginRef.current.startDist > 0) {
        const nextScale = clamp(
          pinchOriginRef.current.startScale *
            (dist / pinchOriginRef.current.startDist),
          TEXT_OVERLAY_MIN_SCALE,
          TEXT_OVERLAY_MAX_SCALE,
        );
        onChange?.({ ...layer, scale: nextScale });
      }
      return;
    }

    const drag = dragOriginRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    onChange?.({
      ...layer,
      x: clamp(drag.layerX + dx / rect.width, 0.08, 0.92),
      y: clamp(drag.layerY + dy / rect.height, 0.08, 0.92),
    });
  };

  const endPointer = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragOriginRef.current;
    const wasTap =
      Boolean(drag) &&
      drag!.pointerId === e.pointerId &&
      !drag!.moved &&
      pointersRef.current.size <= 1;

    pointersRef.current.delete(e.pointerId);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }

    if (pointersRef.current.size < 2) pinchOriginRef.current = null;
    if (pointersRef.current.size === 0) {
      if (wasTap) onEdit?.(layer);
      dragOriginRef.current = null;
    }
  };

  return (
    <button
      ref={rootRef as React.RefObject<HTMLButtonElement>}
      type="button"
      aria-label="Edit text"
      className={`touch-none ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {layer.content}
    </button>
  );
}
