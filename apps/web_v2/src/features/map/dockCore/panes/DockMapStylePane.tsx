'use client';

import BasemapStylePicker from '@/features/map/dockCore/compass/BasemapStylePicker';
import { DockPaneShell } from '@/features/map/dockCore/panes/DockPaneShell';

/**
 * Map style only — independent of Controls layers, Find Me, route, and 2D/3D pitch.
 */
export default function DockMapStylePane() {
  return (
    <DockPaneShell>
      <div className="pb-6">
        <BasemapStylePicker />
      </div>
    </DockPaneShell>
  );
}
