'use client';

import { formatRelativeTime } from '@/features/community/pinPostApi';
import type { TodayXpSourceRecord } from '@/features/today/records/records';
import {
  TodayRecordList,
  TodayRecordShell,
  TodayRecordStatRow,
} from '@/features/today/records/TodayRecordShell';
import { xpSourceCategory } from '@/features/xp/logic/xpSources';

const CATEGORY_LABEL: Record<string, string> = {
  progression: 'Progression',
  engagement: 'Engagement',
  bonus: 'Bonus',
};

export function XpSourceDetail({
  record,
  onClose,
}: {
  record: TodayXpSourceRecord;
  onClose: () => void;
}) {
  const { source, recent, totalXp, level } = record;
  const category = xpSourceCategory(source.sourceType);
  return (
    <TodayRecordShell
      eyebrow={category ? CATEGORY_LABEL[category] ?? 'XP source' : 'XP source'}
      title={source.label}
      subtitle={`+${source.xp} XP`}
      meta={`Level ${level} · ${totalXp} XP total`}
      onClose={onClose}
    >
      <div className="space-y-2">
        <TodayRecordStatRow label="From this source" value={`+${source.xp}`} />
        <TodayRecordStatRow label="Share of total" value={totalXp > 0 ? `${Math.round((source.xp / totalXp) * 100)}%` : '—'} />
        {category ? (
          <TodayRecordStatRow label="Category" value={CATEGORY_LABEL[category] ?? category} />
        ) : null}
        {recent.length > 0 ? (
          <div className="pt-1">
            <TodayRecordList
              items={recent.slice(0, 10).map((item) => ({
                id: item.id,
                title: item.name ?? item.label,
                detail: formatRelativeTime(item.claimedAt ?? item.createdAt),
                trailing: `+${item.amount}`,
              }))}
            />
          </div>
        ) : null}
      </div>
    </TodayRecordShell>
  );
}
