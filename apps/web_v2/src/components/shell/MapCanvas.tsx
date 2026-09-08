'use client';

import { forwardRef } from 'react';

type MapCanvasProps = {
  error?: string | null;
};

/** Full-bleed Mapbox host. Engine mounts into the forwarded ref. */
export const MapCanvas = forwardRef<HTMLDivElement, MapCanvasProps>(function MapCanvas(
  { error },
  ref
) {
  return (
    <div className="map-canvas" role="application" aria-label="Minnesota map">
      <div ref={ref} className="map-canvas__host" />
      {error ? (
        <div className="map-canvas__error" role="alert">
          <p className="map-canvas__error-title">Map unavailable</p>
          <p className="map-canvas__error-body">{error}</p>
        </div>
      ) : null}
    </div>
  );
});
