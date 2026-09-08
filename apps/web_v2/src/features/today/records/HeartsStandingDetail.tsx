'use client';

import { formatRelativeTime } from '@/features/community/pinPostApi';
import type { TodayHeartsRecord } from '@/features/today/records/records';
import {
  TodayRecordList,
  TodayRecordProgress,
  TodayRecordShell,
  TodayRecordStatRow,
} from '@/features/today/records/TodayRecordShell';

export function HeartsStandingDetail({
  record,
  onClose,
}: {
  record: TodayHeartsRecord;
  onClose: () => void;
}) {
  const remaining = Math.max(0, record.available - record.collected);
  return (
    <TodayRecordShell
      eyebrow="Collectibles"
      title="Hearts"
      subtitle={`${record.collected} of ${record.available} on the map`}
      meta={
        remaining > 0
          ? `${remaining} still out on the map`
          : record.available === 0
            ? 'No hearts on the map yet'
            : 'Every heart found — more may appear'
      }
      onClose={onClose}
    >
      <div className="space-y-2">
        <TodayRecordProgress
          value={record.collected}
          max={record.available}
          tone="rose"
        />
        <TodayRecordStatRow
          label="Collected"
          value={`${record.collected} / ${record.available}`}
        />
        {record.recent.length > 0 ? (
          <div className="pt-1">
            <TodayRecordList
              items={record.recent.slice(0, 8).map((item) => ({
                id: item.id,
                title: item.model?.name ?? 'Heart',
                detail: formatRelativeTime(item.collectedAt),
                trailing: item.reward?.amount ? `+${item.reward.amount}` : undefined,
              }))}
            />
          </div>
        ) : null}
      </div>
    </TodayRecordShell>
  );
}
