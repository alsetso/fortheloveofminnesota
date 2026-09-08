'use client';

import type { ReactNode } from 'react';
import { useAuthSafe } from '@/features/auth';
import type { ActivityTab } from '@/features/community/pinPostApi';
import { ACTIVITY_TYPES } from '@/features/map/dockCore/dockCard/activityTypes';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import type { DockCardId } from '@/features/map/dockCore/dockCard/dockCardTypes';
import { IconChartBar } from '@/features/map/dockCore/core/icons';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { DockActionRow, DockRowChevron } from '@/features/map/dockCore/panes/DockPaneShell';

type ActivityNavRow = {
  id: DockCardId;
  label: string;
  subtitle: string;
  icon: ReactNode;
};

const EXTRA_ROWS: ActivityNavRow[] = [
  {
    id: 'activity-analytics',
    label: 'Analytics',
    subtitle: 'Views on your pins',
    icon: <IconChartBar className="h-5 w-5" />,
  },
];

/**
 * Account → Your activity — pick a type first (more may be added later),
 * then `activity-detail` shows that type's list.
 */
export default function ActivityDockCard() {
  const { openAccount, openDockCard, setActivityTab } = useMapDock();
  const { account } = useAuthSafe();

  const openType = (id: ActivityTab) => {
    setActivityTab(id);
    openDockCard('activity-detail');
  };

  return (
    <DockCardShell
      titleMode="sub"
      backLabel="Account"
      onBack={() => openAccount()}
      eyebrow="Account"
      title="My Content"
      subtitle="Select a type"
    >
      {!account ? (
        <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
          Sign in to see your activity.
        </p>
      ) : (
        <div className="space-y-2">
          {ACTIVITY_TYPES.map((type) => (
            <DockActionRow
              key={type.id}
              title={type.label}
              trailing={<DockRowChevron />}
              onClick={() => openType(type.id)}
            />
          ))}
          {EXTRA_ROWS.map((row) => (
            <DockActionRow
              key={row.id}
              title={row.label}
              subtitle={row.subtitle}
              icon={row.icon}
              trailing={<DockRowChevron />}
              onClick={() => openDockCard(row.id)}
            />
          ))}
        </div>
      )}
    </DockCardShell>
  );
}
