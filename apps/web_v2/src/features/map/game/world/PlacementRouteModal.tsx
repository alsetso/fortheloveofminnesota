'use client';

/** Out-of-range world object — route here instead of collect. */

import { useEffect, useState, useSyncExternalStore } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { setActiveRoute } from '@/features/map/dockCore/store/activeRouteStore';
import { formatRangeM } from '@/features/map/game/objectRadar/range';
import { objectRadarActions } from '@/features/map/game/objectRadar/objectRadarStore';
import { haptic } from '@/lib/despia/haptics';
import { fetchDirections } from '@/lib/geo/fetch/fetchDirections';
import { clearRouteGeometry, setRouteGeometry } from '@/lib/geo/nearby/routeLineStore';
import { getWorldModel } from '@/features/map/game/world/catalogStore';
import { placementRouteCopy } from '@/features/map/game/world/placementFoundCopy';
import { useFindMeCoords } from '@/map/location/camera/useFindMeCoords';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import {
  closeWorldPlacementRoute,
  getWorldPlacementRouteState,
  subscribeWorldPlacementRoute,
} from '@/features/map/game/world/placementRouteStore';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';

export function PlacementRouteModal() {
  const route = useSyncExternalStore(
    subscribeWorldPlacementRoute,
    getWorldPlacementRouteState,
    () => null,
  );
  const { openYourRoute } = useMapDock();
  const { coords, lookupCoords } = useFindMeCoords();
  const from = coords ?? lookupCoords ?? getFindMeLastCoords();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBusy(false);
    setError(null);
  }, [route?.featureId]);

  if (!route) return null;

  const model = getWorldModel(route.kind);
  const modelUrl = model?.url ?? null;
  const copy = placementRouteCopy(route.kind);
  const toLabel =
    copy.label.charAt(0).toUpperCase() + copy.label.slice(1);
  const distanceLabel =
    route.distanceM != null
      ? `${formatRangeM(route.distanceM)} away · range ${formatRangeM(route.rangeM)}`
      : `Outside your ${formatRangeM(route.rangeM)} range`;

  const handleClose = () => {
    haptic.toggle();
    setBusy(false);
    setError(null);
    closeWorldPlacementRoute();
  };

  const handleRoute = async () => {
    if (!from || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await fetchDirections(
        from,
        { lat: route.lat, lng: route.lng },
        { profile: 'walking', toLabel },
      );
      setRouteGeometry(result.geometry);
      setActiveRoute({
        routeId: result.routeId,
        profile: result.profile,
        from,
        to: { lat: route.lat, lng: route.lng },
        toLabel,
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
        meta: result.meta,
      });
      haptic.toggle();
      objectRadarActions.closeSheet();
      closeWorldPlacementRoute();
      openYourRoute();
    } catch (err) {
      clearRouteGeometry();
      setError(err instanceof Error ? err.message : 'No route found');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogBackdrop
      onClose={handleClose}
      dismissible={!busy}
      dimClassName="bg-black/50"
      className="px-5"
      ariaLabel={`Route to ${toLabel}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="world-placement-route-title"
        aria-describedby="world-placement-route-body"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] text-center shadow-xl"
      >
        {modelUrl ? (
          <WorldModelPreviewCanvas
            url={modelUrl}
            className="h-48 w-full border-b border-white/10 bg-[#121214]"
          />
        ) : null}
        <div className="border-b border-white/10 px-5 py-5">
          <h2
            id="world-placement-route-title"
            className="text-[17px] font-semibold tracking-tight text-white"
          >
            {copy.title}
          </h2>
          <p
            id="world-placement-route-body"
            className="mt-2 text-[14px] leading-snug text-white/60"
          >
            {copy.body}
          </p>
          <p className="mt-2 text-[12px] text-white/40">{distanceLabel}</p>
          {error ? (
            <p className="mt-2 text-[12px] text-red-400">{error}</p>
          ) : null}
          {!from ? (
            <p className="mt-2 text-[12px] text-white/40">
              Turn on Find Me to get a walking route.
            </p>
          ) : null}
        </div>

        <div className="flex divide-x divide-white/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="flex-1 py-3.5 text-[16px] font-medium text-white/60 transition active:bg-white/5 disabled:opacity-40"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void handleRoute()}
            disabled={busy || !from}
            className="flex-1 py-3.5 text-[16px] font-semibold text-[#5BA3FF] transition active:bg-white/5 disabled:opacity-60"
          >
            {busy
              ? 'Routing…'
              : from
                ? copy.cta
                : 'Need Find Me'}
          </button>
        </div>
      </div>
    </DialogBackdrop>
  );
}
