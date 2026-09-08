/**
 * Discriminated union of every Today-page record a user can open.
 * One type → one detail component in TodayRecordHost.
 */

import type {
  CollectionsByModel,
  HeartsInUnlockedCtus,
  HeartsProgress,
  RecentCollection,
} from '@/features/collections/useAccountCollections';
import type { PassportKindProgress, PassportUnlock } from '@/features/accountTerritories/store/usePassport';
import type { LevelXpActivity, LevelXpBreakdown, AccountLevelState } from '@/features/xp/logic/useAccountLevel';
import type { PendingXpItem } from '@/features/xp/store/pendingXpStore';

export type TodayLevelRecord = {
  kind: 'level';
  level: AccountLevelState;
};

export type TodayMinnesotaRecord = {
  kind: 'minnesota';
  areasUnlocked: number;
  areasAvailable: number;
  kinds: PassportKindProgress[];
};

export type TodayHeartsRecord = {
  kind: 'hearts';
  collected: number;
  available: number;
  recent: RecentCollection[];
};

export type TodayCollectableRecord = {
  kind: 'collectable';
  model: CollectionsByModel;
  recent: RecentCollection[];
  /** Statewide heart totals — used in the hearts object popup. */
  hearts?: HeartsProgress | null;
  /** Hearts scoped to unlocked cities & towns — main Explore / Today stats. */
  heartsInUnlockedCtus?: HeartsInUnlockedCtus | null;
};

export type TodayPendingXpRecord = {
  kind: 'pending_xp';
  item: PendingXpItem;
};

export type TodayXpSourceRecord = {
  kind: 'xp_source';
  source: LevelXpBreakdown;
  recent: LevelXpActivity[];
  totalXp: number;
  level: number;
};

export type TodayTerritoryKindRecord = {
  kind: 'territory_kind';
  kindProgress: PassportKindProgress;
  unlocked: PassportUnlock[];
};

export type TodayTerritoryRecord = {
  kind: 'territory';
  unlock: PassportUnlock;
  xpAmount?: number;
};

export type TodayActivityRecord = {
  kind: 'activity';
  title: string;
  rewardLine: string;
  standingLine: string;
  sources?: { id: string; name: string; detail?: string; amount: number }[];
};

export type TodayRecord =
  | TodayLevelRecord
  | TodayMinnesotaRecord
  | TodayHeartsRecord
  | TodayCollectableRecord
  | TodayPendingXpRecord
  | TodayXpSourceRecord
  | TodayTerritoryKindRecord
  | TodayTerritoryRecord
  | TodayActivityRecord;
