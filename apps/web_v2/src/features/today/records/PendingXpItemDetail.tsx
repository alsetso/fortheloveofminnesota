'use client';

import { formatRelativeTime } from '@/features/community/pinPostApi';
import type { TodayPendingXpRecord } from '@/features/today/records/records';
import {
  TodayRecordShell,
  TodayRecordStatRow,
} from '@/features/today/records/TodayRecordShell';

export function PendingXpItemDetail({
  record,
  onClose,
}: {
  record: TodayPendingXpRecord;
  onClose: () => void;
}) {
  const { item } = record;
  return (
    <TodayRecordShell
      eyebrow="Unclaimed XP"
      title={item.name}
      subtitle={`+${item.amount} XP`}
      meta="Confirm Claim all to add this to your total"
      onClose={onClose}
    >
      <div className="space-y-2">
        <TodayRecordStatRow label="Source" value={item.sourceLabel} />
        <TodayRecordStatRow label="Amount" value={`+${item.amount} XP`} />
        <TodayRecordStatRow label="Earned" value={formatRelativeTime(item.createdAt)} />
      </div>
    </TodayRecordShell>
  );
}
