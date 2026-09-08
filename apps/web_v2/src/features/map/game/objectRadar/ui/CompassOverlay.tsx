'use client';

/**
 * Object MiniMap chrome: north ticks + camera-forward wedge.
 *
 * Dial is north-up. N stays pinned at top.
 * Wedge points at `mapBearing` — the direction the main-map camera is facing.
 * Orbiting the main map rotates the wedge, showing "what's in front of you
 * from the camera's perspective" on the north-up geographic dial.
 */

import { OBJECT_RADAR_MINIMAP_SIZE_PX } from '@/features/map/game/objectRadar/constants';

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function CompassOverlay({
  mapBearing = 0,
}: {
  /** Main-map camera bearing (clockwise from north). Wedge points this direction. */
  mapBearing?: number;
}) {
  const size = OBJECT_RADAR_MINIMAP_SIZE_PX;
  const wedgeAngle = normalizeDeg(mapBearing);

  return (
    <div
      data-object-radar="compass"
      className="pointer-events-none absolute inset-0"
      aria-hidden
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 h-full w-full"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1}
        />
        {/* N ticks — fixed at top (north-up dial) */}
        <g>
          {[0, 90, 180, 270].map((deg) => (
            <line
              key={deg}
              x1={size / 2}
              y1={4.5}
              x2={size / 2}
              y2={deg === 0 ? 12 : 9.5}
              stroke={deg === 0 ? '#5BA3FF' : 'rgba(255,255,255,0.45)'}
              strokeWidth={deg === 0 ? 2 : 1.25}
              strokeLinecap="round"
              transform={`rotate(${deg} ${size / 2} ${size / 2})`}
            />
          ))}
          <text
            x={size / 2}
            y={17}
            textAnchor="middle"
            fill="#5BA3FF"
            fontSize={8}
            fontWeight={700}
            fontFamily="system-ui, sans-serif"
          >
            N
          </text>
        </g>
        {/* Camera-forward wedge */}
        <g
          transform={`translate(${size / 2} ${size / 2}) rotate(${wedgeAngle})`}
        >
          <polygon
            points="0,-9 6,6.5 0,3.5 -6,6.5"
            fill="#5BA3FF"
            stroke="#050608"
            strokeWidth={1.25}
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
