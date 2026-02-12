'use client';

import { useMemo } from 'react';
import { createPortal } from 'react-dom';

const STATE_COLOR = '#4A90E2';
const COUNTY_COLOR = '#7ED321';
const DISTRICT_COLORS: Record<number, string> = {
  1: '#FF6B6B',
  2: '#4ECDC4',
  3: '#45B7D1',
  4: '#96CEB4',
  5: '#FFEAA7',
  6: '#DDA15E',
  7: '#BC6C25',
  8: '#6C5CE7',
};
const CTU_COLORS: Record<string, string> = {
  CITY: '#4A90E2',
  TOWNSHIP: '#7ED321',
  'UNORGANIZED TERRITORY': '#F5A623',
};

function getBoundaryColor(boundary: {
  layer: 'state' | 'county' | 'ctu' | 'district';
  details?: Record<string, unknown>;
}): string {
  if (boundary.layer === 'state') return STATE_COLOR;
  if (boundary.layer === 'county') return COUNTY_COLOR;
  if (boundary.layer === 'district') {
    const num = boundary.details?.district_number as number | undefined;
    return num ? DISTRICT_COLORS[num] ?? '#888888' : '#888888';
  }
  if (boundary.layer === 'ctu') {
    const ctuClass = boundary.details?.ctu_class as string | undefined;
    return ctuClass ? CTU_COLORS[ctuClass] ?? '#7ED321' : '#7ED321';
  }
  return '#7ED321';
}

interface ExploreCursorHoverLabelProps {
  boundary: { layer: string; name: string; details?: Record<string, unknown> };
  cursorX: number;
  cursorY: number;
}

/**
 * Cursor-following label shown when hovering boundaries on explore table map.
 * Desktop only; small colored circle + title.
 */
const LABEL_OFFSET = 14;
const LABEL_EST_WIDTH = 200;
const LABEL_EST_HEIGHT = 36;
const VIEWPORT_PAD = 8;

export default function ExploreCursorHoverLabel({
  boundary,
  cursorX,
  cursorY,
}: ExploreCursorHoverLabelProps) {
  const color = getBoundaryColor(boundary as Parameters<typeof getBoundaryColor>[0]);

  const position = useMemo(() => {
    if (typeof window === 'undefined') return { left: cursorX + LABEL_OFFSET, top: cursorY + LABEL_OFFSET };
    let left = cursorX + LABEL_OFFSET;
    let top = cursorY + LABEL_OFFSET;
    if (left + LABEL_EST_WIDTH > window.innerWidth - VIEWPORT_PAD) {
      left = cursorX - LABEL_EST_WIDTH - LABEL_OFFSET;
    }
    if (top + LABEL_EST_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
      top = cursorY - LABEL_EST_HEIGHT - LABEL_OFFSET;
    }
    left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - LABEL_EST_WIDTH - VIEWPORT_PAD));
    top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - LABEL_EST_HEIGHT - VIEWPORT_PAD));
    return { left, top };
  }, [cursorX, cursorY]);

  const label = (
    <div
      className="fixed pointer-events-none z-[9999] flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface/95 backdrop-blur-sm border border-border shadow-lg"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-medium text-foreground whitespace-nowrap">
        {boundary.name}
      </span>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(label, document.body)
    : label;
}
