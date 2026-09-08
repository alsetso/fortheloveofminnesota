'use client';

import { formatRelativeTime } from '@/features/community/pinPostApi';
import type { TodayTerritoryRecord } from '@/features/today/records/records';
import {
  TodayRecordShell,
  TodayRecordStatRow,
} from '@/features/today/records/TodayRecordShell';

const KIND_LABEL: Record<string, string> = {
  // district: hidden for first launch
  county: 'County',
  ctu: 'City / township',
  school_district: 'School district',
  // senate_district / house_district: hidden for first launch
};

export function TerritoryUnlockDetail({
  record,
  onClose,
}: {
  record: TodayTerritoryRecord;
  onClose: () => void;
}) {
  const { unlock, xpAmount } = record;
  return (
    <TodayRecordShell
      eyebrow="Area unlocked"
      title={unlock.name}
      subtitle={KIND_LABEL[unlock.unitKind] ?? unlock.unitKind}
      meta={
        xpAmount != null
          ? `+${xpAmount} XP when claimed`
          : `First seen ${formatRelativeTime(unlock.firstSeenAt)}`
      }
      onClose={onClose}
    >
      <div className="space-y-2">
        <TodayRecordStatRow
          label="Kind"
          value={KIND_LABEL[unlock.unitKind] ?? unlock.unitKind}
        />
        <TodayRecordStatRow label="Unlocked" value={formatRelativeTime(unlock.firstSeenAt)} />
        {xpAmount != null ? (
          <TodayRecordStatRow label="XP" value={`+${xpAmount}`} />
        ) : null}
      </div>
    </TodayRecordShell>
  );
}
