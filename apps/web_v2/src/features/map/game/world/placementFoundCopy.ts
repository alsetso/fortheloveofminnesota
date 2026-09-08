/**
 * Tap-a-placement modal copy — per-verb, two-axis resolution.
 *
 * Admin controls title (found_header) and body (found_footer) on every model.
 * When unset, defaults are generated from the ObjectClass — never from purpose.
 */

import type { WorldModelReward, WorldModelSlug, WorldModelSpec } from '@/features/map/game/world/catalog';
import { getWorldModel } from '@/features/map/game/world/catalogStore';
import {
  classifyObject,
  isClaimVerb,
  resolveModelVerb,
  type ModelVerb,
  type ObjectClass,
} from '@/features/map/game/world/modelVerbs';

export type PlacementFoundCopy = {
  title: string;
  body: string;
  /** Canonical resolved verb. */
  verb: ModelVerb;
  /** Resolved object class — drives button copy and modal layout. */
  objectClass: ObjectClass;
  /** Optional CTA URL for info-verb tap_payload.url. */
  ctaUrl?: string | null;
  /** Optional CTA label for info-verb tap_payload.ctaLabel. */
  ctaLabel?: string | null;
};

export type PlacementRouteCopy = {
  title: string;
  body: string;
  cta: string;
  verb: ModelVerb;
  label: string;
};

// ── Default copy per ObjectClass ───────────────────────────────────────────

function rewardBody(model: WorldModelSpec, reward: WorldModelReward): string {
  const label = model.label.toLowerCase();
  if (reward.type === 'credits') {
    const n = reward.amount ?? 1;
    return `Grab this ${label} for ${n} credit${n === 1 ? '' : 's'}.`;
  }
  if (reward.type === 'hearts') {
    const n = reward.amount ?? 1;
    return `Grab this ${label} for ${n} heart${n === 1 ? '' : 's'}.`;
  }
  if (reward.type === 'loot') {
    return `Add this ${label} to your collection.`;
  }
  return `Collect this ${label} — it'll count toward your statewide total.`;
}

function defaultTitle(
  model: WorldModelSpec | undefined,
  cls: ObjectClass,
  label: string,
): string {
  switch (cls) {
    case 'collectible': return `You found a ${label}!`;
    case 'discovery':   return model?.label?.trim() || label;
    case 'check_in':    return `Check in at ${label}`;
    case 'info':        return model?.label?.trim() || label;
    case 'route':       return `Route to ${label}`;
    case 'unlock':      return `Unlock ${label}`;
    case 'redeem':      return `Redeem at ${label}`;
    case 'challenge':   return `Challenge: ${label}`;
    default:            return model?.label?.trim() || label;
  }
}

function defaultBody(
  model: WorldModelSpec | undefined,
  cls: ObjectClass,
  label: string,
): string {
  switch (cls) {
    case 'collectible':
      return model?.reward
        ? rewardBody(model, model.reward)
        : `Collect this ${label} — it'll count toward your statewide total.`;
    case 'discovery':
      return `You've discovered the ${label}. Marked in your finds.`;
    case 'check_in':
      return `You're close enough to check in at the ${label} — stamp your visit.`;
    case 'info':
      return `Tap to learn more about this ${label}.`;
    case 'route':
      return `Get directions to this ${label}.`;
    case 'unlock':
      return `Spend credits to reveal this ${label}.`;
    case 'redeem':
      return `Show this screen to redeem your ${label}.`;
    case 'challenge':
      return `This is a quest step for ${label}. Accept to continue.`;
    default:
      return '';
  }
}

// ── Main copy resolver ─────────────────────────────────────────────────────

export function placementFoundCopy(kind: WorldModelSlug): PlacementFoundCopy {
  const model = getWorldModel(kind) ?? undefined;
  const verb = resolveModelVerb(model?.interaction);
  const objectClass = classifyObject(model?.interaction, model?.onCollect);
  const label = model?.label ?? 'item';

  const title = model?.foundHeader?.trim() || defaultTitle(model, objectClass, label);
  const body  = model?.foundFooter?.trim() || defaultBody(model, objectClass, label);

  // Extract optional info verb CTA from tap_payload
  let ctaUrl: string | null = null;
  let ctaLabel: string | null = null;
  if (verb === 'info' && model?.tapPayload && typeof model.tapPayload === 'object') {
    const p = model.tapPayload as Record<string, unknown>;
    ctaUrl   = typeof p.url      === 'string' ? p.url      : null;
    ctaLabel = typeof p.ctaLabel === 'string' ? p.ctaLabel : null;
  }

  return { title, body, verb, objectClass, ctaUrl, ctaLabel };
}

// ── Route card copy ────────────────────────────────────────────────────────

/**
 * Out-of-range route card — prefers Admin copy, then verb-aware defaults.
 * Never shows "You found a…" while the user is still out of range.
 */
export function placementRouteCopy(kind: WorldModelSlug): PlacementRouteCopy {
  const model = getWorldModel(kind) ?? undefined;
  const verb = resolveModelVerb(model?.interaction);
  const cls = classifyObject(model?.interaction, model?.onCollect);
  const label = model?.label ?? 'object';

  const title = model?.foundHeader?.trim() || 'Out of range';
  let body = model?.foundFooter?.trim() || '';

  if (!body) {
    switch (cls) {
      case 'collectible':
        body = `This ${label} is outside your collect range. Get closer to grab it.`;
        break;
      case 'discovery':
        body = `This ${label} is outside your find range. Walk closer to confirm the discovery.`;
        break;
      case 'check_in':
        body = `You need to be within range to check in at this ${label}.`;
        break;
      case 'info':
        body = `This ${label} is outside your range. Route there to read more.`;
        break;
      default:
        body = `Route to this ${label} to get within range.`;
    }
  }

  const cta =
    verb === 'route'
      ? `Route to ${label}`
      : isClaimVerb(verb)
        ? cls === 'check_in'
          ? 'Route to check in'
          : cls === 'discovery'
            ? 'Route to discover'
            : 'Route to collect'
        : 'Route here';

  return { title, body, cta, verb, label };
}

/** Index helper for callers that look up by kind. */
export const PLACEMENT_FOUND_COPY = new Proxy(
  {} as Record<WorldModelSlug, PlacementFoundCopy>,
  {
    get(_target, prop: string) {
      return placementFoundCopy(prop);
    },
  },
);
