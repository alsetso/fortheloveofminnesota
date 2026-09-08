/**
 * World model verb + classification foundation.
 *
 * ## Two-axis architecture
 *
 * iOS behavior is driven by exactly two fields:
 *   interaction (verb)   — what happens when you tap the object
 *   on_collect           — whether a claimed object disappears or stays
 *
 * `purpose` is admin organization metadata — it never drives iOS behavior.
 * Use `classifyObject()` as the single source of truth for all tier decisions.
 *
 * ## Verb → ObjectClass mapping
 *
 *   collect + remove → 'collectible'   coins, hearts — consumed on claim
 *   collect + stay   → 'discovery'     landmarks — permanent, confirm-found
 *   check_in         → 'check_in'      visit stamps — proximity XP, no wallet
 *   info             → 'info'          read-only card + optional link
 *   route            → 'route'         navigation intent
 *   unlock           → 'unlock'        credit gate (rolling out)
 *   redeem           → 'redeem'        booth/code (rolling out)
 *   challenge        → 'challenge'     quest step (rolling out)
 *   see / none       → 'prop'          silent atmosphere — no tap card
 *
 * ## Slow rollout
 *
 * Unimplemented verbs degrade safely via effectiveVerb():
 *   unlock / redeem / challenge → info card (until those flows ship)
 * Add a verb to IMPLEMENTED_MODEL_VERBS when its UI ships.
 */

// ── Verb types ─────────────────────────────────────────────────────────────

/** All verbs the DB CHECK constraint allows. */
export const MODEL_VERBS = [
  'see',
  'info',
  'collect',
  'route',
  'check_in',
  'unlock',
  'redeem',
  'challenge',
] as const;

export type ModelVerb = (typeof MODEL_VERBS)[number];

/** Legacy DB value kept for backward compatibility. */
export type ModelVerbDb = ModelVerb | 'none';

// ── Purpose types (admin metadata — not iOS behavior drivers) ──────────────

export const MODEL_PURPOSES = [
  'presence',
  'utility',
  'collectible',
  'progress',
  'story',
  'social',
  'redeem',
] as const;

export type ModelPurpose = (typeof MODEL_PURPOSES)[number];

// ── Object classification (the single source of truth for iOS tier logic) ──

/**
 * Unified object class — derived from interaction + on_collect only.
 * Never derived from purpose.
 */
export type ObjectClass =
  | 'collectible'  // collect + on_collect=remove  — consumable (coins, hearts)
  | 'discovery'    // collect + on_collect=stay     — permanent landmark / find
  | 'check_in'     // check_in verb                — visit stamp
  | 'info'         // info verb                    — read-only card
  | 'route'        // route verb                   — navigation
  | 'unlock'       // unlock verb                  — credit gate (stub)
  | 'redeem'       // redeem verb                  — booth/code (stub)
  | 'challenge'    // challenge verb               — quest step (stub)
  | 'prop';        // see / none                   — silent atmosphere

/**
 * The single classification function for all iOS tier decisions.
 * Replaces `resolveModelPurpose` everywhere in behavior paths.
 */
export function classifyObject(
  interaction: string | null | undefined,
  onCollect?: string | null,
): ObjectClass {
  const verb = resolveModelVerb(interaction);
  switch (verb) {
    case 'collect':
      return onCollect === 'stay' ? 'discovery' : 'collectible';
    case 'check_in': return 'check_in';
    case 'info':     return 'info';
    case 'route':    return 'route';
    case 'unlock':   return 'unlock';
    case 'redeem':   return 'redeem';
    case 'challenge':return 'challenge';
    case 'see':      return 'prop';
  }
}

/** Whether the object class requires a server-side claim (proximity enforced). */
export function isClaimableClass(cls: ObjectClass): boolean {
  return cls === 'collectible' || cls === 'discovery' || cls === 'check_in';
}

/** Whether the object class shows a full found/discovery card on tap. */
export function isCardClass(cls: ObjectClass): boolean {
  return cls !== 'prop';
}

// ── Verb resolution ────────────────────────────────────────────────────────

/** Which verbs the iOS client actually handles today. */
export const IMPLEMENTED_MODEL_VERBS: ReadonlySet<ModelVerb> = new Set<ModelVerb>([
  'see',
  'info',
  'collect',
  'route',
  'check_in',   // ✓ shipped — proximity claim, XP stamp, no wallet payout
]);

const VERB_SET = new Set<string>(MODEL_VERBS);

/** Normalize DB / API value → canonical verb. */
export function resolveModelVerb(
  interaction: string | null | undefined,
): ModelVerb {
  const raw = (interaction ?? 'see').trim().toLowerCase();
  if (raw === 'none' || raw === '') return 'see';
  if (VERB_SET.has(raw)) return raw as ModelVerb;
  return 'see'; // unknown future verbs degrade to silent
}

/**
 * Effective tap verb — unimplemented future verbs degrade to info card.
 * Use this in tap handlers, not in classification logic.
 */
export function effectiveVerb(verb: ModelVerb): ModelVerb {
  if (IMPLEMENTED_MODEL_VERBS.has(verb)) return verb;
  if (verb === 'see') return 'see';
  return 'info'; // safe degradation: unlock/redeem/challenge → info card
}

/** Collect payout path — server RPC keys off interaction = 'collect' | 'check_in'. */
export function isClaimVerb(verb: ModelVerb): boolean {
  return verb === 'collect' || verb === 'check_in';
}

/**
 * @deprecated Use isClaimVerb or classifyObject.
 * Kept for call-site migration — returns true only for 'collect'.
 */
export function isCollectVerb(verb: ModelVerb): boolean {
  return verb === 'collect';
}

/** Opens a card / modal (not silent scenery). */
export function isInteractiveVerb(verb: ModelVerb): boolean {
  return verb !== 'see';
}

/** Priority for Object Radar rim ticks — claimables first. */
export function radarVerbPriority(verb: ModelVerb): number {
  switch (verb) {
    case 'collect':   return 0;
    case 'check_in':  return 1;
    case 'info':      return 2;
    case 'route':     return 3;
    case 'unlock':
    case 'redeem':
    case 'challenge': return 4;
    default:          return 9;
  }
}

// ── Purpose branch (admin organization — read-only in iOS) ─────────────────

/**
 * Purpose metadata for display / admin palette grouping.
 * NEVER use purpose to drive iOS tap behavior — use classifyObject() instead.
 */
export const PURPOSE_BRANCH: Record<
  ModelPurpose,
  { label: string; subcategories: string[]; defaultVerb: ModelVerb }
> = {
  presence:   { label: 'Presence',   subcategories: ['scenery', 'wayfinding', 'landmarks'], defaultVerb: 'see'      },
  utility:    { label: 'Utility',    subcategories: ['amenities', 'services', 'transit'],   defaultVerb: 'info'     },
  collectible:{ label: 'Collectible',subcategories: ['drip', 'hearts', 'stamps', 'rares'],  defaultVerb: 'collect'  },
  progress:   { label: 'Progress',   subcategories: ['visits', 'unlocks', 'levels'],        defaultVerb: 'check_in' },
  story:      { label: 'Story',      subcategories: ['scavenger', 'events', 'sponsors'],    defaultVerb: 'collect'  },
  social:     { label: 'Social',     subcategories: ['pins', 'photos'],                     defaultVerb: 'info'     },
  redeem:     { label: 'Redeem',     subcategories: ['booth', 'codes'],                     defaultVerb: 'redeem'   },
};

export function isModelVerb(value: string): value is ModelVerbDb {
  return value === 'none' || VERB_SET.has(value);
}

export function isModelPurpose(value: string): value is ModelPurpose {
  return (MODEL_PURPOSES as readonly string[]).includes(value);
}

/**
 * @deprecated Behavior should use classifyObject(). Kept as a display utility only.
 * Maps an interaction + verb to a purpose label for UI display.
 */
export function resolveModelPurpose(
  purpose: string | null | undefined,
  verb: ModelVerb,
): ModelPurpose {
  const raw = (purpose ?? '').trim().toLowerCase();
  if ((MODEL_PURPOSES as readonly string[]).includes(raw)) return raw as ModelPurpose;
  if (verb === 'collect') return 'collectible';
  if (verb === 'info' || verb === 'route') return 'utility';
  if (verb === 'redeem') return 'redeem';
  if (verb === 'check_in' || verb === 'unlock') return 'progress';
  if (verb === 'challenge') return 'story';
  return 'presence';
}
