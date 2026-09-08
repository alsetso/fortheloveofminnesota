'use client';

/**
 * "See on map" — portals a Mapbox pin preview above the feed, anchored to the
 * link and clamped inside the viewport. Hides on scroll. Visible frame crops
 * 2rem off the bottom of the Mapbox canvas.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import {
  applyBeigeDiscoverMapStyle,
  DISCOVER_MAP_BEIGE,
  DISCOVER_MAP_STYLE,
  DISCOVER_MAP_TERRITORY,
} from '@/features/discover/beigeDiscoverMapStyle';
import { MAP_CONFIG } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';

/** Visible frame crops this much off the bottom of the Mapbox canvas. */
const CROP_BOTTOM_REM = 2;
const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 176; // h-44
const GAP = 10;
const EDGE = 12;
const CARET = 8;

type Placement = 'below' | 'above';

type PanelPos = {
  top: number;
  left: number;
  width: number;
  placement: Placement;
  /** Caret tip X relative to panel left. */
  caretLeft: number;
};

function clampPanel(anchor: DOMRect): PanelPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(PANEL_WIDTH, vw - EDGE * 2);

  let placement: Placement = 'below';
  let top = anchor.bottom + GAP;
  if (top + PANEL_HEIGHT + CARET > vh - EDGE) {
    placement = 'above';
    top = anchor.top - GAP - PANEL_HEIGHT;
  }
  top = Math.max(EDGE, Math.min(top, vh - EDGE - PANEL_HEIGHT));

  let left = anchor.right - width;
  left = Math.max(EDGE, Math.min(left, vw - EDGE - width));

  const anchorCenter = anchor.left + anchor.width / 2;
  const caretLeft = Math.max(
    14,
    Math.min(width - 14, anchorCenter - left),
  );

  return { top, left, width, placement, caretLeft };
}

export function PostSeeOnMapPopover({
  lat,
  lng,
  className = '',
}: {
  lat: number;
  lng: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  const onToggle = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);

  const syncPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    setPos(clampPanel(el.getBoundingClientRect()));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    syncPosition();
  }, [open, syncPosition]);

  // Hide on any scroll; keep on-screen if the window resizes.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => close();
    const onResize = () => syncPosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close, syncPosition]);

  // Outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Mount Mapbox when open + panel positioned
  useEffect(() => {
    if (!open || !pos) return;
    const el = hostRef.current;
    if (!el || !MAP_CONFIG.MAPBOX_TOKEN) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    let cancelled = false;
    let map: MapboxMap | null = null;
    let marker: Marker | null = null;

    void (async () => {
      try {
        const mapbox = await loadMapboxGL();
        if (cancelled || !hostRef.current) return;
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;
        map = new mapbox.Map({
          container: hostRef.current,
          style: DISCOVER_MAP_STYLE,
          center: [lng, lat],
          zoom: 14.25,
          pitch: 0,
          interactive: true,
          attributionControl: false,
          fadeDuration: 0,
          dragRotate: false,
          touchPitch: false,
          pitchWithRotate: false,
        });
        await new Promise<void>((resolve) => {
          if (!map) {
            resolve();
            return;
          }
          if (map.isStyleLoaded()) {
            resolve();
            return;
          }
          map.once('load', () => resolve());
        });
        if (cancelled || !map) return;
        applyBeigeDiscoverMapStyle(map);
        map.addControl(
          new mapbox.NavigationControl({
            showCompass: false,
            visualizePitch: false,
          }),
          'top-right',
        );
        marker = new mapbox.Marker({ color: DISCOVER_MAP_TERRITORY })
          .setLngLat([lng, lat])
          .addTo(map);
        mapRef.current = map;
        markerRef.current = marker;
        map.resize();
        map.jumpTo({
          center: [lng, lat],
          zoom: 14.25,
          padding: {
            top: 12,
            left: 12,
            right: 12,
            bottom: 12 + CROP_BOTTOM_REM * 16,
          },
        });
      } catch {
        /* best-effort preview */
      }
    })();

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current = null;
      marker?.remove();
      map?.remove();
    };
  }, [open, pos, lat, lng]);

  const panel =
    open && mounted && pos
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Post location"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed z-[200]"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
            }}
          >
            {/* Caret pointing at the active "See on map" link */}
            <span
              aria-hidden
              className="pointer-events-none absolute z-[1] h-3 w-3 rotate-45 border border-black/[0.1] bg-[#f7f5f1]"
              style={
                pos.placement === 'below'
                  ? {
                      top: -6,
                      left: pos.caretLeft - 6,
                      borderBottom: 'none',
                      borderRight: 'none',
                    }
                  : {
                      bottom: -6,
                      left: pos.caretLeft - 6,
                      borderTop: 'none',
                      borderLeft: 'none',
                    }
              }
            />
            <div className="relative overflow-hidden rounded-xl border border-black/[0.1] bg-[#f7f5f1] shadow-[0_12px_32px_rgba(0,0,0,0.18)] ring-1 ring-lake-blue/25">
              <div
                className="relative w-full overflow-hidden touch-none"
                style={{
                  height: PANEL_HEIGHT,
                  backgroundColor: DISCOVER_MAP_BEIGE,
                }}
              >
                <div
                  ref={hostRef}
                  className="absolute inset-x-0 top-0 w-full"
                  style={{ height: `calc(100% + ${CROP_BOTTOM_REM}rem)` }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`shrink-0 font-semibold transition active:opacity-70 ${
          open
            ? 'rounded-sm bg-lake-blue/15 px-1 text-lake-blue underline decoration-lake-blue/50 underline-offset-2'
            : 'text-lake-blue'
        } ${className}`.trim()}
      >
        See on map
      </button>
      {panel}
    </>
  );
}
