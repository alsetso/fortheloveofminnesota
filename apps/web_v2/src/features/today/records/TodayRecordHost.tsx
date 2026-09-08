'use client';

/**
 * Renders the correct record-level detail component for whatever Today
 * dataset row the user tapped.
 */

import { ActivityRecordDetail } from '@/features/today/records/ActivityRecordDetail';
import { CollectableModelDetail } from '@/features/collections/CollectableModelDetail';
import { HeartsStandingDetail } from '@/features/today/records/HeartsStandingDetail';
import { LevelStandingDetail } from '@/features/today/records/LevelStandingDetail';
import { MinnesotaUnlockedDetail } from '@/features/today/records/MinnesotaUnlockedDetail';
import { PendingXpItemDetail } from '@/features/today/records/PendingXpItemDetail';
import type { TodayRecord } from '@/features/today/records/records';
import { TerritoryKindDetail } from '@/features/today/records/TerritoryKindDetail';
import { TerritoryUnlockDetail } from '@/features/today/records/TerritoryUnlockDetail';
import { XpSourceDetail } from '@/features/today/records/XpSourceDetail';

export function TodayRecordHost({
  record,
  onClose,
}: {
  record: TodayRecord | null;
  onClose: () => void;
}) {
  if (!record) return null;

  switch (record.kind) {
    case 'level':
      return <LevelStandingDetail record={record} onClose={onClose} />;
    case 'minnesota':
      return <MinnesotaUnlockedDetail record={record} onClose={onClose} />;
    case 'hearts':
      return <HeartsStandingDetail record={record} onClose={onClose} />;
    case 'collectable':
      return <CollectableModelDetail record={record} onClose={onClose} />;
    case 'pending_xp':
      return <PendingXpItemDetail record={record} onClose={onClose} />;
    case 'xp_source':
      return <XpSourceDetail record={record} onClose={onClose} />;
    case 'territory_kind':
      return <TerritoryKindDetail record={record} onClose={onClose} />;
    case 'territory':
      return <TerritoryUnlockDetail record={record} onClose={onClose} />;
    case 'activity':
      return <ActivityRecordDetail record={record} onClose={onClose} />;
    default:
      return null;
  }
}
