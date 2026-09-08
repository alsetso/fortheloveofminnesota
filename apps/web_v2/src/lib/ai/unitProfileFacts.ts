/**
 * Territory unit foundation facts.
 *
 * Layer 1 — real columns: description, website_url, contact_email, contact_phone
 * Layer 2 — attrs (kind-varying): population, features.best / features.worst
 * Layer 3 — evidence: citation URLs (ai.subject_citations) + proposal source_urls
 *
 * Kind-native attrs (county_name, district_code, …) are left untouched.
 *
 * Chat extract → buildFoundationCompareRows (pending review) → review_foundation
 * applies approved rows only. See docs/place-ai-foundation.md.
 */

export const UNIT_PROFILE_KEYS = [
  'description',
  'website_url',
  'contact_email',
  'contact_phone',
] as const;

export type UnitProfileKey = (typeof UNIT_PROFILE_KEYS)[number];

export type UnitProfilePatch = Partial<Record<UnitProfileKey, string>>;

export type UnitAttrsFeatures = {
  best?: string[];
  worst?: string[];
};

export type UnitAttrsPatch = {
  population?: number;
  features?: UnitAttrsFeatures;
};

export type UnitFoundationFacts = {
  profile: UnitProfilePatch;
  attrs: UnitAttrsPatch;
  source_urls: string[];
};

export type UnitFoundationUnit = {
  description: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  attrs: Record<string, unknown>;
};

const FACTS_FENCE_RE =
  /```(?:ftlom-facts)?\s*\n([\s\S]*?)\n```/i;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/;
const URL_RE = /https?:\/\/[^\s)>\]]+/gi;

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

function asPositiveInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    return Math.round(v);
  }
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

function asStringList(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.replace(/[.,;:]+$/, ''));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Deep-merge foundation attrs without clobbering kind-native keys. */
export function mergeUnitAttrs(
  existing: Record<string, unknown>,
  patch: UnitAttrsPatch,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing };

  if (patch.population != null) {
    next.population = patch.population;
  }

  if (patch.features) {
    const prevFeat =
      existing.features &&
      typeof existing.features === 'object' &&
      !Array.isArray(existing.features)
        ? (existing.features as Record<string, unknown>)
        : {};
    const features: Record<string, unknown> = { ...prevFeat };
    if (patch.features.best) features.best = patch.features.best;
    if (patch.features.worst) features.worst = patch.features.worst;
    next.features = features;
  }

  return next;
}

export function readAttrsFoundation(attrs: Record<string, unknown>): {
  population: number | null;
  features: UnitAttrsFeatures;
} {
  const population = asPositiveInt(attrs.population);
  const featRaw =
    attrs.features && typeof attrs.features === 'object' && !Array.isArray(attrs.features)
      ? (attrs.features as Record<string, unknown>)
      : {};
  return {
    population,
    features: {
      best: asStringList(featRaw.best),
      worst: asStringList(featRaw.worst),
    },
  };
}

function factsFromObject(raw: Record<string, unknown>): UnitFoundationFacts {
  const profile: UnitProfilePatch = {};
  for (const key of UNIT_PROFILE_KEYS) {
    const v = asTrimmedString(raw[key]);
    if (v) profile[key] = v;
  }

  const attrs: UnitAttrsPatch = {};
  const population = asPositiveInt(raw.population);
  if (population != null) attrs.population = population;

  const featuresRaw =
    raw.features && typeof raw.features === 'object' && !Array.isArray(raw.features)
      ? (raw.features as Record<string, unknown>)
      : raw;
  const best = asStringList(featuresRaw.best ?? raw.best_features ?? raw.best);
  const worst = asStringList(featuresRaw.worst ?? raw.worst_features ?? raw.worst);
  if (best.length || worst.length) {
    attrs.features = {};
    if (best.length) attrs.features.best = best;
    if (worst.length) attrs.features.worst = worst;
  }

  const source_urls: string[] = [];
  const urls = raw.source_urls;
  if (Array.isArray(urls)) {
    for (const u of urls) {
      if (typeof u !== 'string') continue;
      const n = normalizeUrl(u);
      if (n && !source_urls.includes(n)) source_urls.push(n);
    }
  }

  return { profile, attrs, source_urls };
}

function heuristicFacts(text: string, citationUrls: string[]): UnitFoundationFacts {
  const profile: UnitProfilePatch = {};
  const email = text.match(EMAIL_RE)?.[0];
  if (email) profile.contact_email = email;

  const phone = text.match(PHONE_RE)?.[0];
  if (phone) profile.contact_phone = phone.replace(/\s+/g, ' ').trim();

  const urls = [...text.matchAll(URL_RE)]
    .map((m) => normalizeUrl(m[0]))
    .filter((u): u is string => Boolean(u));
  const preferred =
    urls.find((u) => !/openai\.com|wikipedia\.org/i.test(u)) ??
    citationUrls.map(normalizeUrl).find((u): u is string => Boolean(u)) ??
    urls[0];
  if (preferred) profile.website_url = preferred;

  return {
    profile,
    attrs: {},
    source_urls: citationUrls
      .map(normalizeUrl)
      .filter((u): u is string => Boolean(u))
      .slice(0, 8),
  };
}

const EMPTY_FACTS = (): UnitFoundationFacts => ({
  profile: {},
  attrs: {},
  source_urls: [],
});

/**
 * Strip optional ```ftlom-facts``` block from model answer and parse foundation facts.
 * Heuristics (email/phone/website scrape) are opt-in so focused tools like Fill Officials
 * do not accidentally open an About review table from prose/citations.
 */
export function extractUnitFoundationFromAnswer(
  answer: string,
  citationUrls: string[] = [],
  opts?: { allowHeuristics?: boolean },
): { cleanAnswer: string; facts: UnitFoundationFacts; fromBlock: boolean } {
  const allowHeuristics = opts?.allowHeuristics ?? true;
  const match = answer.match(FACTS_FENCE_RE);
  if (match) {
    const cleanAnswer = answer.replace(match[0], '').trim();
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const facts = factsFromObject(parsed as Record<string, unknown>);
        for (const u of citationUrls) {
          const n = normalizeUrl(u);
          if (n && !facts.source_urls.includes(n)) facts.source_urls.push(n);
        }
        return { cleanAnswer, facts, fromBlock: true };
      }
    } catch {
      /* fall through */
    }
    if (!allowHeuristics) {
      return { cleanAnswer, facts: EMPTY_FACTS(), fromBlock: false };
    }
    return {
      cleanAnswer,
      facts: heuristicFacts(cleanAnswer || answer, citationUrls),
      fromBlock: false,
    };
  }

  if (!allowHeuristics) {
    return { cleanAnswer: answer, facts: EMPTY_FACTS(), fromBlock: false };
  }

  return {
    cleanAnswer: answer,
    facts: heuristicFacts(answer, citationUrls),
    fromBlock: false,
  };
}

function emptyish(v: string | null | undefined): boolean {
  return !v?.trim();
}

/**
 * Only propose fills for empty profile fields, missing population,
 * and new feature strings. Never overwrite populated columns from chat noise.
 */
export function diffFoundationAgainstUnit(
  unit: UnitFoundationUnit,
  facts: UnitFoundationFacts,
): UnitFoundationFacts {
  const profile: UnitProfilePatch = {};
  for (const key of UNIT_PROFILE_KEYS) {
    const next = facts.profile[key];
    if (!next) continue;
    if (emptyish(unit[key])) profile[key] = next;
  }

  const attrs: UnitAttrsPatch = {};
  const current = readAttrsFoundation(unit.attrs);
  if (facts.attrs.population != null && current.population == null) {
    attrs.population = facts.attrs.population;
  }

  const bestIncoming = facts.attrs.features?.best ?? [];
  const worstIncoming = facts.attrs.features?.worst ?? [];
  const bestNew = bestIncoming.filter((x) => !(current.features.best ?? []).includes(x));
  const worstNew = worstIncoming.filter((x) => !(current.features.worst ?? []).includes(x));
  if (bestNew.length || worstNew.length) {
    attrs.features = {};
    if (bestNew.length) {
      attrs.features.best = [...(current.features.best ?? []), ...bestNew].slice(0, 8);
    }
    if (worstNew.length) {
      attrs.features.worst = [...(current.features.worst ?? []), ...worstNew].slice(0, 8);
    }
  }

  return {
    profile,
    attrs,
    source_urls: facts.source_urls.slice(0, 8),
  };
}

export function foundationHasWork(facts: UnitFoundationFacts): boolean {
  return (
    Object.keys(facts.profile).length > 0 ||
    facts.attrs.population != null ||
    Boolean(facts.attrs.features?.best?.length) ||
    Boolean(facts.attrs.features?.worst?.length)
  );
}

export function foundationFieldLabels(facts: UnitFoundationFacts): string[] {
  const labels: string[] = [];
  for (const key of UNIT_PROFILE_KEYS) {
    if (facts.profile[key]) labels.push(key.replace(/_/g, ' '));
  }
  if (facts.attrs.population != null) labels.push('population');
  if (facts.attrs.features?.best?.length) labels.push('best features');
  if (facts.attrs.features?.worst?.length) labels.push('worst features');
  return labels;
}

export const FOUNDATION_COMPARE_KEYS = [
  ...UNIT_PROFILE_KEYS,
  'population',
  'features.best',
  'features.worst',
] as const;

export type FoundationCompareKey = (typeof FOUNDATION_COMPARE_KEYS)[number];

export type FoundationRowStatus = 'pending' | 'accepted' | 'rejected';

/** One field for admin/dev Existing vs New review before write. */
export type FoundationCompareRow = {
  key: FoundationCompareKey;
  label: string;
  existing: string;
  proposed: string;
  /** Value used when this row is approved. */
  proposedValue: string | number | string[];
  status: FoundationRowStatus;
};

const COMPARE_LABELS: Record<FoundationCompareKey, string> = {
  description: 'Overview',
  website_url: 'Website',
  contact_email: 'Email',
  contact_phone: 'Phone',
  population: 'Population',
  'features.best': 'Best features',
  'features.worst': 'Challenges',
};

function displayOrEmpty(v: string | null | undefined): string {
  const t = v?.trim();
  return t ? t : '—';
}

function displayList(items: string[] | undefined): string {
  if (!items?.length) return '—';
  return items.join('; ');
}

function listsEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((v, i) => v === right[i]);
}

/**
 * Build Existing vs New rows from extracted facts vs current unit.
 * Includes overwrites when the model proposes a different value — apply is review-gated.
 */
export function buildFoundationCompareRows(
  unit: UnitFoundationUnit,
  facts: UnitFoundationFacts,
): FoundationCompareRow[] {
  const rows: FoundationCompareRow[] = [];
  const current = readAttrsFoundation(unit.attrs);

  for (const key of UNIT_PROFILE_KEYS) {
    const proposed = facts.profile[key];
    if (!proposed) continue;
    const existing = unit[key]?.trim() ?? '';
    if (existing === proposed) continue;
    rows.push({
      key,
      label: COMPARE_LABELS[key],
      existing: displayOrEmpty(existing),
      proposed,
      proposedValue: proposed,
      status: 'pending',
    });
  }

  if (facts.attrs.population != null && facts.attrs.population !== current.population) {
    rows.push({
      key: 'population',
      label: COMPARE_LABELS.population,
      existing:
        current.population != null ? current.population.toLocaleString('en-US') : '—',
      proposed: facts.attrs.population.toLocaleString('en-US'),
      proposedValue: facts.attrs.population,
      status: 'pending',
    });
  }

  const best = facts.attrs.features?.best;
  if (best?.length && !listsEqual(best, current.features.best)) {
    rows.push({
      key: 'features.best',
      label: COMPARE_LABELS['features.best'],
      existing: displayList(current.features.best),
      proposed: displayList(best),
      proposedValue: best,
      status: 'pending',
    });
  }

  const worst = facts.attrs.features?.worst;
  if (worst?.length && !listsEqual(worst, current.features.worst)) {
    rows.push({
      key: 'features.worst',
      label: COMPARE_LABELS['features.worst'],
      existing: displayList(current.features.worst),
      proposed: displayList(worst),
      proposedValue: worst,
      status: 'pending',
    });
  }

  return rows;
}

/** Rebuild a facts patch from approved compare rows. */
export function factsFromApprovedRows(
  rows: FoundationCompareRow[],
  sourceUrls: string[] = [],
): UnitFoundationFacts {
  const profile: UnitProfilePatch = {};
  const attrs: UnitAttrsPatch = {};
  const features: UnitAttrsFeatures = {};

  for (const row of rows) {
    if (row.status !== 'accepted') continue;
    if (row.key === 'population') {
      if (typeof row.proposedValue === 'number') attrs.population = row.proposedValue;
      continue;
    }
    if (row.key === 'features.best') {
      if (Array.isArray(row.proposedValue)) {
        features.best = row.proposedValue.filter((x): x is string => typeof x === 'string');
      }
      continue;
    }
    if (row.key === 'features.worst') {
      if (Array.isArray(row.proposedValue)) {
        features.worst = row.proposedValue.filter((x): x is string => typeof x === 'string');
      }
      continue;
    }
    if (typeof row.proposedValue === 'string' && row.proposedValue.trim()) {
      profile[row.key] = row.proposedValue.trim();
    }
  }

  if (features.best?.length || features.worst?.length) {
    attrs.features = features;
  }

  return {
    profile,
    attrs,
    source_urls: sourceUrls.slice(0, 8),
  };
}

export function isFoundationCompareKey(v: unknown): v is FoundationCompareKey {
  return typeof v === 'string' && (FOUNDATION_COMPARE_KEYS as readonly string[]).includes(v);
}
