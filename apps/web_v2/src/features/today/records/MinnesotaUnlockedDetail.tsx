'use client';

import type { PassportKindProgress } from '@/features/accountTerritories/store/usePassport';
import type { TodayMinnesotaRecord } from '@/features/today/records/records';
import {
  TodayRecordList,
  TodayRecordShell,
  TodayRecordStatRow,
} from '@/features/today/records/TodayRecordShell';

function formatUnlockedPct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  if (pct < 10) return `${pct.toFixed(1)}%`;
  if (pct >= 99.95 && pct < 100) return '99.9%';
  return `${Math.round(pct)}%`;
}

function kindShare(kind: PassportKindProgress, areasAvailable: number): string {
  if (areasAvailable <= 0 || kind.total <= 0) return '0% of map';
  const share = (kind.total / areasAvailable) * 100;
  if (share < 0.1) return '<0.1% of map';
  if (share < 10) return `${share.toFixed(1)}% of map`;
  return `${Math.round(share)}% of map`;
}

export function MinnesotaUnlockedDetail({
  record,
  onClose,
}: {
  record: TodayMinnesotaRecord;
  onClose: () => void;
}) {
  const pct =
    record.areasAvailable > 0
      ? (record.areasUnlocked / record.areasAvailable) * 100
      : 0;
  const pctLabel = formatUnlockedPct(pct);
  const kinds = [...record.kinds].sort((a, b) => b.unlocked - a.unlocked || b.total - a.total);

  return (
    <TodayRecordShell
      eyebrow="Minnesota"
      title={pctLabel}
      subtitle="of Minnesota unlocked"
      meta={`${record.areasUnlocked.toLocaleString()} of ${record.areasAvailable.toLocaleString()} areas`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-white/5 px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">
            How we calculate this
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            Minnesota % = areas you&apos;ve unlocked ÷ every passport area in the state.
            Each county, city/township, school district, legislative seat, congressional
            district, and zip counts as one area — same weight.
          </p>
          <p className="mt-2 text-[13px] tabular-nums text-white/55">
            {record.areasUnlocked.toLocaleString()} ÷ {record.areasAvailable.toLocaleString()} ={' '}
            {pctLabel}
          </p>
        </div>

        <div className="space-y-2">
          <TodayRecordStatRow
            label="Areas unlocked"
            value={record.areasUnlocked.toLocaleString()}
          />
          <TodayRecordStatRow
            label="Areas in Minnesota"
            value={record.areasAvailable.toLocaleString()}
          />
          <TodayRecordStatRow label="Still locked" value={Math.max(0, record.areasAvailable - record.areasUnlocked).toLocaleString()} />
        </div>

        {kinds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">
              By area type
            </p>
            <TodayRecordList
              items={kinds.map((kind) => ({
                id: kind.unitKind,
                title: kind.label,
                detail: `${kind.unlocked.toLocaleString()} of ${kind.total.toLocaleString()} · ${kindShare(kind, record.areasAvailable)}`,
                trailing:
                  kind.total > 0
                    ? formatUnlockedPct((kind.unlocked / kind.total) * 100)
                    : '0%',
              }))}
            />
          </div>
        ) : null}
      </div>
    </TodayRecordShell>
  );
}
