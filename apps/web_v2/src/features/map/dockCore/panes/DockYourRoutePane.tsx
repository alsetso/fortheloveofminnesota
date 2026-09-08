'use client';

import { useEffect } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useActiveRoute } from '@/features/map/dockCore/hooks/useActiveRoute';
import { clearActiveRoute } from '@/features/map/dockCore/store/activeRouteStore';
import { useCanUseRouteFeature } from '@/features/map/dockCore/hooks/useCanUseRouteFeature';
import {
  DockActionRow,
  DockPaneShell,
  DockSection,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  formatDurationSeconds,
  formatMetersAsMiles,
} from '@/lib/geo/crowFliesDistance';
import { clearRouteGeometry } from '@/lib/geo/nearby/routeLineStore';
import {
  ToolPrimaryButton,
  ToolStatusLine,
} from '@/features/tools/core/toolUi';

/**
 * Your route — dynamic details after Get route. Back / clear stops the painted route.
 * Admin / localhost only.
 */
export default function DockYourRoutePane() {
  const { back } = useMapDock();
  const { route } = useActiveRoute();
  const canUseRoute = useCanUseRouteFeature();

  useEffect(() => {
    if (canUseRoute) return;
    clearRouteGeometry();
    clearActiveRoute();
    back();
  }, [canUseRoute, back]);

  function clearAndBack() {
    clearRouteGeometry();
    clearActiveRoute();
    back();
  }

  if (!canUseRoute) return null;

  if (!route) {
    return (
      <DockPaneShell>
        <div className="space-y-5 pb-6">
          <DockSection title="Your route" subtitle="No active route">
            <ToolStatusLine>Get a route from Selected point or Where I&apos;m at.</ToolStatusLine>
            <ToolPrimaryButton variant="secondary" onClick={() => back()}>
              Back
            </ToolPrimaryButton>
          </DockSection>
        </div>
      </DockPaneShell>
    );
  }

  return (
    <DockPaneShell>
      <div className="space-y-5 pb-6">
        <DockSection
          title="Your route"
          subtitle={`${route.profile} · ${route.toLabel}`}
        >
          <DockActionRow
            title={`${formatMetersAsMiles(route.distanceMeters)} · ${formatDurationSeconds(route.durationSeconds)}`}
            subtitle="Road distance & ETA"
          />
          <DockActionRow
            title="From"
            subtitle={`${route.from.lat.toFixed(5)}°, ${route.from.lng.toFixed(5)}°`}
          />
          <DockActionRow
            title="To"
            subtitle={`${route.toLabel} · ${route.to.lat.toFixed(5)}°, ${route.to.lng.toFixed(5)}°`}
          />
          {route.routeId ? (
            <DockActionRow
              title="Saved lookup"
              subtitle={`Route id · ${route.routeId.slice(0, 8)}…`}
            />
          ) : null}
        </DockSection>

        <div className="space-y-2">
          <ToolPrimaryButton variant="secondary" onClick={clearAndBack}>
            Clear route
          </ToolPrimaryButton>
        </div>
      </div>
    </DockPaneShell>
  );
}
