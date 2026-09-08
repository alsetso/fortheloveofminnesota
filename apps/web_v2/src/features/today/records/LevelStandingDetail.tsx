'use client';

import { getLevelTier } from '@/features/xp/logic/levelTiers';
import type { TodayLevelRecord } from '@/features/today/records/records';
import {
  TodayRecordList,
  TodayRecordShell,
} from '@/features/today/records/TodayRecordShell';

export function LevelStandingDetail({
  record,
  onClose,
}: {
  record: TodayLevelRecord;
  onClose: () => void;
}) {
  const { level } = record;
  const tier = getLevelTier(level.level);
  const xpIntoLevel = Math.min(
    Math.max(0, level.totalXp - level.xpForCurrentLevel),
    Math.max(1, level.xpForNextLevel - level.xpForCurrentLevel),
  );
  const xpSpan = Math.max(1, level.xpForNextLevel - level.xpForCurrentLevel);
  const xpToNext = Math.max(0, level.xpForNextLevel - level.totalXp);
  const progressPct = Math.round(Math.max(0, Math.min(1, xpIntoLevel / xpSpan)) * 100);
  const nextLevel = level.level + 1;

  return (
    <TodayRecordShell
      title={`Level ${level.level}`}
      subtitle={tier.name}
      meta={`${level.totalXp.toLocaleString()} XP claimed`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {level.level < 99 ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium text-white/55">
                XP toward Level {nextLevel}
              </p>
              <p className="text-[12px] tabular-nums text-white/45">{progressPct}%</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-[#5BA3FF] transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[12px] tabular-nums text-white/40">
              {xpIntoLevel.toLocaleString()} / {xpSpan.toLocaleString()} XP this level
              {xpToNext > 0 ? ` · ${xpToNext.toLocaleString()} XP to go` : ''}
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-white/5 px-3 py-2.5 text-[13px] text-white/70">
            Max level reached — new XP still adds to your total.
          </p>
        )}

        {level.breakdown.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">
              Where your XP came from
            </p>
            <TodayRecordList
              items={level.breakdown.map((row) => ({
                id: row.sourceType,
                title: row.label,
                trailing: `+${row.xp.toLocaleString()}`,
              }))}
            />
          </div>
        ) : (
          <p className="text-[13px] text-white/45">
            Claim area unlocks, streaks, or collect finds to grow this total.
          </p>
        )}
      </div>
    </TodayRecordShell>
  );
}
