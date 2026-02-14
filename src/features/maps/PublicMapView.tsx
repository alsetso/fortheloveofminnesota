'use client';

import { useRef, useEffect, useState } from 'react';
import { useMapboxMap } from '@/app/map/[id]/hooks/useMapboxMap';
import { usePinMarker } from '@/hooks/usePinMarker';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import MentionsLayer from '@/features/map/components/MentionsLayer';
import type { MapboxMapInstance } from '@/types/mapbox-events';

export interface PublicMapPin {
  id: string;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

interface PublicMapViewProps {
  pins: PublicMapPin[];
  selectedPinId?: string | null;
  selectedPin?: { id: string; lat: number; lng: number; description?: string | null; caption?: string | null; emoji?: string | null; image_url?: string | null; video_url?: string | null; view_count?: number | null; created_at: string; account_id?: string | null; account?: { id: string; username?: string | null; image_url?: string | null } | null; mention_type?: { emoji?: string | null; name: string } | null } | null;
  currentAccountId?: string | null;
  /** When set, show a temp marker at this location (e.g. location-selected modal open). */
  locationMarker?: { lat: number; lng: number } | null;
  /** Coords from map click (for skeleton popup before pin fetch completes). */
  selectedPinCoords?: { lat: number; lng: number } | null;
  /** True while fetching pin details (show skeleton). */
  isLoadingPin?: boolean;
  onPinSelect: (pinId: string, coords?: { lat: number; lng: number }) => void;
  onPinDeselect: () => void;
  onLocationSelect: (info: { lat: number; lng: number; address: string | null; mapMeta?: Record<string, unknown> | null }) => void;
  onMapLoad?: (map: MapboxMapInstance) => void;
  /** Called after pin-view POST succeeds with the updated view_count from the server. */
  onViewRecorded?: (pinId: string, viewCount: number) => void;
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/**
 * Public map view for /maps. Uses MentionsLayer (GPU symbol layer) for pins
 * instead of DOM markers, so pin rendering respects layerStyles.ts icon-size.
 */
export default function PublicMapView({
  selectedPinId,
  selectedPin,
  currentAccountId,
  locationMarker,
  selectedPinCoords,
  isLoadingPin = false,
  onPinSelect,
  onPinDeselect,
  onLocationSelect,
  onMapLoad,
  onViewRecorded,
}: PublicMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const { mapInstance, mapLoaded } = useMapboxMap({
    mapStyle: 'street',
    containerRef,
    meta: null,
    onMapLoad,
    restrictToMinnesota: false,
  });

  usePinMarker({
    map: mapInstance,
    coordinates: locationMarker ?? null,
    color: 'red',
    enabled: !!locationMarker && !!mapLoaded,
    behindModal: true,
  });

  // Track zoom level for indicator
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;
    const map = mapInstance as any;
    if (map.removed) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on('zoom', update);
    return () => { if (!map.removed) map.off('zoom', update); };
  }, [mapLoaded, mapInstance]);

  // Listen for MentionsLayer pin clicks and forward to parent.
  // MentionsLayer dispatches mention-click twice (immediate + enriched data).
  // Deduplicate so onPinSelect only fires once per pin click.
  const lastHandledPinRef = useRef<{ id: string; ts: number } | null>(null);
  useEffect(() => {
    const handleMentionClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.mention?.id) return;
      const mention = detail.mention;
      const id = String(mention.id);
      const now = Date.now();
      // Skip duplicate dispatch for same pin within 2s
      if (lastHandledPinRef.current?.id === id && now - lastHandledPinRef.current.ts < 2000) return;
      lastHandledPinRef.current = { id, ts: now };
      onPinSelect(id, { lat: mention.lat, lng: mention.lng });
    };

    window.addEventListener('mention-click', handleMentionClick);
    return () => {
      window.removeEventListener('mention-click', handleMentionClick);
    };
  }, [onPinSelect]);

  // Map click on empty area: open location flow
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;
    const map = mapInstance as any;
    if (map.removed) return;

    const handleClick = (e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => {
      // Check if the click hit a MentionsLayer pin; if so, skip location flow
      try {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['map-mentions-point', 'map-mentions-point-label'],
        });
        if (features && features.length > 0) return;
      } catch {
        // Layer may not exist yet; continue with location flow
      }

      if (selectedPinId) onPinDeselect();
      const { lng, lat } = e.lngLat;

      let mapMeta: Record<string, unknown> | null = null;
      try {
        const point = map.project([lng, lat]);
        const result = queryFeatureAtPoint(map, point, 'labels-first', false);
        if (result) {
          const extractedFeature = 'feature' in result ? result.feature : result;
          if (extractedFeature && 'layerId' in extractedFeature) {
            mapMeta = {
              feature: {
                layerId: extractedFeature.layerId,
                name: extractedFeature.name ?? null,
                icon: extractedFeature.icon ?? null,
                properties: extractedFeature.properties ?? {},
              },
            };
          }
        }
      } catch {
        // Ignore feature query errors
      }

      onLocationSelect({ lat, lng, address: null, mapMeta });
    };

    map.on('click', handleClick);
    return () => {
      if (map && !map.removed) map.off('click', handleClick);
    };
  }, [mapLoaded, mapInstance, onPinDeselect, onLocationSelect, selectedPinId]);

  const popupViewedPinIdRef = useRef<string | null>(null);
  const isProgrammaticRemoveRef = useRef(false);
  const popupPinIdRef = useRef<string | null>(null);

  // Popup + pin-view POST
  useEffect(() => {
    if (!mapLoaded || !mapInstance || !selectedPinId) {
      if (popupRef.current) {
        isProgrammaticRemoveRef.current = true;
        popupRef.current.remove();
        popupRef.current = null;
      }
      popupViewedPinIdRef.current = null;
      popupPinIdRef.current = null;
      return;
    }
    const map = mapInstance as any;
    if (map.removed) return;

    const lat = selectedPin?.lat ?? selectedPinCoords?.lat;
    const lng = selectedPin?.lng ?? selectedPinCoords?.lng;
    if (lat == null || lng == null) return;

    const d = selectedPin as any;
    const showSkeleton = isLoadingPin || !d;
    const accountUsername = d?.account?.username ?? null;
    const accountImageUrl = d?.account?.image_url ?? null;
    const profileUrl = accountUsername ? `/${encodeURIComponent(accountUsername)}` : null;
    const displayName = accountUsername || 'User';
    const description = d?.description ?? d?.caption ?? d?.emoji ?? '';
    const imageUrl = d?.image_url ?? null;
    const mentionType = d?.mention_type;
    const typeEmoji = mentionType?.emoji ?? null;
    const typeName = mentionType?.name ?? null;
    const dateStr = formatDate(d?.created_at || new Date().toISOString());
    const descTruncated = description ? String(description).slice(0, 80) + (String(description).length > 80 ? '…' : '') : '';
    const pinOwnerId = d?.account_id ?? d?.account?.id ?? null;
    const isOwner = Boolean(currentAccountId && pinOwnerId && String(currentAccountId) === String(pinOwnerId));

    const existingPopup = popupRef.current;
    const canUpdateInPlace = existingPopup && !showSkeleton && popupPinIdRef.current === selectedPinId;

    const createPopupHtml = (vc: number | null, error = false, skeleton = false) => {
      if (skeleton) {
        return `
        <div class="map-mention-popup-content" style="min-width: 220px; max-width: 280px; background: white; border-radius: 8px; overflow: hidden;">
          <div style="padding: 15px 8px 8px 8px;">
            <div style="height: 14px; width: 80%; background: #e5e7eb; border-radius: 4px; margin-bottom: 8px;"></div>
            <div style="height: 10px; width: 40%; background: #e5e7eb; border-radius: 4px;"></div>
          </div>
          <div style="padding: 8px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
              <div style="width: 18px; height: 18px; border-radius: 50%; background: #e5e7eb;"></div>
              <div style="height: 12px; width: 60px; background: #e5e7eb; border-radius: 4px;"></div>
            </div>
            <div style="height: 10px; width: 24px; background: #e5e7eb; border-radius: 4px;"></div>
            <a href="/mention/${escapeHtml(selectedPinId)}" style="font-size: 11px; font-weight: 500; color: #2563eb;">View</a>
          </div>
        </div>
      `;
      }
      const viewSlot = error
        ? `<span style="font-size: 10px; color: #dc2626;">Couldn't record view</span>`
        : vc != null
          ? `<span style="font-size: 10px; color: #6b7280; display: flex; align-items: center; gap: 2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${vc.toLocaleString()}</span>`
          : '';
      return `
      <div class="map-mention-popup-content" style="min-width: 220px; max-width: 280px; background: white; border-radius: 8px; overflow: hidden;">
        ${imageUrl ? `<a href="/mention/${escapeHtml(selectedPinId)}" style="display: block; width: 100%; height: 120px; overflow: hidden; background: #f3f4f6;"><img src="${escapeHtml(imageUrl)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" /></a>` : ''}
        <div style="padding: ${imageUrl ? '8px' : '15px 8px 8px 8px'};">
          ${descTruncated ? `<p style="margin: 0 0 6px; font-size: 12px; color: #374151; line-height: 1.4;">${escapeHtml(descTruncated)}</p>` : ''}
          ${typeName ? `<div style="font-size: 11px; color: #6b7280;">${typeEmoji ? `<span style="margin-right: 4px;">${escapeHtml(String(typeEmoji))}</span>` : ''}<span>${escapeHtml(typeName)}</span></div>` : ''}
        </div>
        <div style="padding: 8px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <a href="${profileUrl || '#'}" style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; text-decoration: none; color: inherit;" ${profileUrl ? '' : 'onclick="event.preventDefault()"'}>
            ${accountImageUrl ? `<img src="${escapeHtml(accountImageUrl)}" alt="" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />` : `<div style="width: 18px; height: 18px; border-radius: 50%; background: #f3f4f6; flex-shrink: 0; font-size: 9px; color: #6b7280; display: flex; align-items: center; justify-content: center;">${escapeHtml((displayName[0] || '?').toUpperCase())}</div>`}
            <span style="font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(displayName)}</span>
          </a>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            ${viewSlot}
            <span style="font-size: 10px; color: #6b7280;">${dateStr}</span>
            ${isOwner ? `<a href="/mention/${escapeHtml(selectedPinId)}/edit" style="font-size: 11px; font-weight: 500; color: #2563eb;">Edit</a>` : ''}
            <a href="/mention/${escapeHtml(selectedPinId)}" style="font-size: 11px; font-weight: 500; color: #2563eb;">View</a>
          </div>
        </div>
      </div>
    `;
    };

    const shouldPostView = popupViewedPinIdRef.current !== selectedPinId && !showSkeleton;
    const displayVc = d?.view_count != null ? Number(d.view_count) : null;

    const runPinViewPost = () => {
      const referrer = typeof document !== 'undefined' ? document.referrer : null;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
      let deviceId: string | null = null;
      if (typeof window !== 'undefined') {
        deviceId = localStorage.getItem('analytics_device_id');
        if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
          deviceId = crypto.randomUUID();
          localStorage.setItem('analytics_device_id', deviceId);
        }
      }
      fetch('/api/analytics/pin-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin_id: selectedPinId,
          referrer_url: referrer || null,
          user_agent: userAgent || null,
          session_id: deviceId,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          const vc = body?.view_count;
          if (vc != null && onViewRecorded) onViewRecorded(selectedPinId, Number(vc));
        })
        .catch(() => {});
    };

    if (shouldPostView) popupViewedPinIdRef.current = selectedPinId;

    if (canUpdateInPlace && existingPopup) {
      existingPopup.setHTML(createPopupHtml(displayVc, false, false));
      if (shouldPostView) runPinViewPost();
      return () => {
        if (popupRef.current) {
          isProgrammaticRemoveRef.current = true;
          popupRef.current.remove();
          popupRef.current = null;
        }
      };
    }

    if (popupRef.current) {
      isProgrammaticRemoveRef.current = true;
      popupRef.current.remove();
      popupRef.current = null;
      popupPinIdRef.current = null;
    }

    import('mapbox-gl').then((mapbox) => {
      if (!map || map.removed) return;
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
        popupPinIdRef.current = null;
      }
      const popup = new mapbox.default.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '280px',
        anchor: 'bottom',
        className: 'map-mention-popup',
      })
        .setLngLat([lng, lat])
        .setHTML(createPopupHtml(showSkeleton ? null : displayVc, false, showSkeleton))
        .addTo(map);

      popup.on('close', () => {
        if (!isProgrammaticRemoveRef.current) onPinDeselect();
        isProgrammaticRemoveRef.current = false;
      });
      popupRef.current = popup;
      popupPinIdRef.current = selectedPinId;

      if (shouldPostView) runPinViewPost();
    });

    return () => {
      if (popupRef.current) {
        isProgrammaticRemoveRef.current = true;
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [mapLoaded, mapInstance, selectedPinId, selectedPin, selectedPinCoords, isLoadingPin, currentAccountId, onPinDeselect, onViewRecorded]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full min-h-[400px]" aria-label="Map" />
      {mapInstance && mapLoaded && (
        <MentionsLayer
          map={mapInstance}
          mapLoaded={mapLoaded}
          clusterPins={false}
          skipClickHandlers={false}
          selectedMentionId={selectedPinId}
        />
      )}
      {zoom != null && (
        <div className="absolute bottom-3 right-3 px-2 py-1 bg-white/90 border border-gray-200 rounded-md text-xs text-gray-600 font-medium pointer-events-none select-none">
          z{zoom.toFixed(1)}
        </div>
      )}
    </>
  );
}
