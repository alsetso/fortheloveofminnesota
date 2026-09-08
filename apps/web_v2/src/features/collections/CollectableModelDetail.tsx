'use client';

import {
  CollectibleList,
  CollectibleProgress,
  CollectibleSheet,
  CollectibleStatRow,
} from '@/features/collections/CollectibleSheet';
import type { TodayCollectableRecord } from '@/features/today/records/records';
import { formatRelativeTime } from '@/features/community/pinPostApi';
import { resolveWorldModelUrl, type WorldModelSlug } from '@/features/map/game/world';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';

const HEART_SLUG = 'heart-quaternius';

function modelUrl(slug: string, filePath?: string | null): string | null {
  const path = filePath?.trim();
  if (!path) return null;
  return resolveWorldModelUrl(path, slug as WorldModelSlug);
}

function recentRewardLabel(reward: {
  type: string;
  amount?: number;
  item?: string;
  xp?: number;
} | null): string {
  if (!reward) return 'Collected';
  const bits: string[] = [];
  if (reward.type === 'hearts') {
    const n = reward.amount ?? 1;
    bits.push(`+${n} heart${n === 1 ? '' : 's'}`);
  } else if (reward.type === 'credits') {
    const n = reward.amount ?? 1;
    bits.push(`+${n} credit${n === 1 ? '' : 's'}`);
  } else if (reward.type === 'loot' && reward.item) {
    bits.push(reward.item);
  }
  if (reward.xp) bits.push(`+${reward.xp} XP`);
  return bits.join(' · ') || 'Collected';
}

/** Collectible detail — always presented in {@link CollectibleSheet}. */
export function CollectableModelDetail({
  record,
  onClose,
}: {
  record: TodayCollectableRecord;
  onClose: () => void;
}) {
  const { model, recent, hearts, heartsInUnlockedCtus } = record;
  const isHeart = model.slug === HEART_SLUG;
  const done = model.availableTotal > 0 && model.count >= model.availableTotal;
  const url = modelUrl(model.slug, model.filePath);
  const label = model.name.toLowerCase();
  const leftInCities = heartsInUnlockedCtus?.remaining ?? null;

  const meta = isHeart
    ? leftInCities != null && leftInCities > 0
      ? `${leftInCities.toLocaleString()} left in your unlocked cities`
      : done
        ? 'All found on the map'
        : model.remaining > 0
          ? `${model.remaining} left on the map`
          : model.availableTotal === 0
            ? 'None on the map right now'
            : `${model.count} collected`
    : done
      ? 'All found on the map'
      : model.remaining > 0
        ? `${model.remaining} left on the map`
        : model.availableTotal === 0
          ? 'None on the map right now'
          : `${model.count} collected`;

  return (
    <CollectibleSheet
      eyebrow={model.rare ? 'Rare find' : isHeart ? 'Heart find' : 'Collectible'}
      title={model.name}
      subtitle={model.xp > 0 ? `+${model.xp} XP each` : null}
      meta={meta}
      media={
        url ? (
          <WorldModelPreviewCanvas url={url} className="h-48 w-full" />
        ) : null
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-white/55">
          {isHeart
            ? "Claimable in cities and towns you've unlocked — parks, streets, and open spots you can reach in person. Get close on the map and tap Collect."
            : 'Placed randomly in public areas across Minnesota — parks, streets, and open spots you can reach in person. Find one on the map, get close, and tap Collect.'}
        </p>

        {isHeart && heartsInUnlockedCtus ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
              In unlocked areas
            </p>
            <CollectibleStatRow
              label="Left in your cities"
              value={heartsInUnlockedCtus.remaining}
            />
            <CollectibleStatRow
              label="Outside unlocked"
              value={heartsInUnlockedCtus.remainingOutside}
            />
            <CollectibleStatRow
              label="Collected there"
              value={heartsInUnlockedCtus.collected}
            />
            <CollectibleStatRow
              label="Total on the map"
              value={hearts?.available ?? model.availableTotal}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
            Your progress
          </p>
          <CollectibleProgress
            value={model.count}
            max={model.availableTotal}
            tone={isHeart ? 'rose' : 'lake'}
          />
          {model.xp > 0 ? (
            <CollectibleStatRow label="XP per collect" value={`+${model.xp} XP`} />
          ) : null}
          <CollectibleStatRow label="Collected" value={model.count} />
          <CollectibleStatRow label="On the map" value={model.availableTotal} />
          <CollectibleStatRow label="Remaining" value={model.remaining} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
            Your collections
          </p>
          {recent.length > 0 ? (
            <CollectibleList
              items={recent.slice(0, 12).map((item) => ({
                id: item.id,
                title: formatRelativeTime(item.collectedAt),
                detail: recentRewardLabel(item.reward),
                trailing: item.reward?.xp ? `+${item.reward.xp}` : undefined,
              }))}
            />
          ) : (
            <p className="rounded-2xl bg-white/5 px-3.5 py-3 text-[13px] leading-snug text-white/45">
              None yet — find a {label} on the map and tap Collect to start this
              collection.
            </p>
          )}
        </div>
      </div>
    </CollectibleSheet>
  );
}
