'use client';

import type { TodayActivityRecord } from '@/features/today/records/records';
import {
  TodayRecordList,
  TodayRecordShell,
} from '@/features/today/records/TodayRecordShell';

export function ActivityRecordDetail({
  record,
  onClose,
}: {
  record: TodayActivityRecord;
  onClose: () => void;
}) {
  return (
    <TodayRecordShell
      title={record.title}
      subtitle={record.rewardLine}
      meta={record.standingLine}
      onClose={onClose}
      ariaLabel={record.title}
    >
      {record.sources && record.sources.length > 0 ? (
        <TodayRecordList
          items={record.sources.map((s) => ({
            id: s.id,
            title: s.name,
            detail: s.detail,
            trailing: `+${s.amount}`,
          }))}
        />
      ) : null}
    </TodayRecordShell>
  );
}
