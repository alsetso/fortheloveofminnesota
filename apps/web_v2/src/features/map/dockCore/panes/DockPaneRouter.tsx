'use client';

import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import DockBrowsePane from '@/features/map/dockCore/panes/DockBrowsePane';
import DockCityPane from '@/features/map/dockCore/panes/DockCityPane';
import DockSearchPane from '@/features/map/dockCore/panes/DockSearchPane';
import DockMapStylePane from '@/features/map/dockCore/panes/DockMapStylePane';
import DockToolsPane from '@/features/map/dockCore/panes/DockToolsPane';
import DockDetailsPane from '@/features/map/dockCore/panes/DockDetailsPane';
import DockAccountPane from '@/features/map/dockCore/panes/DockAccountPane';
import DockSubpagePane from '@/features/map/dockCore/panes/DockSubpagePane';
import DockSelectedPointPane from '@/features/map/dockCore/panes/DockSelectedPointPane';
import DockYourRoutePane from '@/features/map/dockCore/panes/DockYourRoutePane';
import DockTodayPane from '@/features/map/dockCore/panes/DockTodayPane';
import DockPostComposePane from '@/features/map/dockCore/panes/DockPostComposePane';

/** Renders the active dock pane from the typed stack. */
export default function DockPaneRouter() {
  const { pane } = useMapDock();

  switch (pane.id) {
    case 'browse':
      return <DockBrowsePane />;
    case 'city':
      return <DockCityPane ctu={pane.ctu} />;
    case 'search':
      return <DockSearchPane />;
    case 'map-style':
      return <DockMapStylePane />;
    case 'tools':
      return <DockToolsPane />;
    case 'details':
      return <DockDetailsPane entity={pane.entity} />;
    case 'account':
      return <DockAccountPane />;
    case 'subpage':
      return <DockSubpagePane pane={pane} />;
    case 'selected-point':
      return <DockSelectedPointPane />;
    case 'your-route':
      return <DockYourRoutePane />;
    case 'today':
      return <DockTodayPane />;
    case 'post-compose':
      return (
        <DockPostComposePane
          lat={pane.lat}
          lng={pane.lng}
          address={pane.address}
        />
      );
  }
}
