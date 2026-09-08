'use client';

import type { TodayTerritoryKindRecord } from '@/features/today/records/records';
import {
  TodayRecordProgress,
  TodayRecordShell,
  TodayRecordStatRow,
} from '@/features/today/records/TodayRecordShell';

export function TerritoryKindDetail({
  record,
  onClose,
}: {
  record: TodayTerritoryKindRecord;
  onClose: () => void;
}) {
  const { kindProgress } = record;
  const remaining = Math.max(0, kindProgress.total - kindProgress.unlocked);

  return (
    <TodayRecordShell
      eyebrow="Passport"
      title={kindProgress.label}
      subtitle={`${kindProgress.unlocked} of ${kindProgress.total} unlocked`}
      meta={remaining > 0 ? `${remaining} still to discover` : 'Category complete'}
      onClose={onClose}
    >
      <div className="space-y-2">
        <TodayRecordProgress value={kindProgress.unlocked} max={kindProgress.total} />
        <TodayRecordStatRow label="Unlocked" value={kindProgress.unlocked} />
        <TodayRecordStatRow label="Statewide total" value={kindProgress.total} />
      </div>
    </TodayRecordShell>
  );
}
