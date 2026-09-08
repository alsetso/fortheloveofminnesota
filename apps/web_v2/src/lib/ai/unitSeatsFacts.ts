/**
 * Territory seat proposal facts — AI-extracted officeholders for admin/dev review.
 *
 * Mirrors unitProfileFacts.ts but for seats / holders.
 *
 * Flow:
 *  1. AI emits a ```ftlom-seats``` fence (see buildTerritoryInstructions)
 *  2. extractSeatsFromAnswer parses it from the message text
 *  3. buildSeatsCompareCards diffs proposed vs existing holders → SeatCompareCard[]
 *  4. Cards stored in meta.seats on the assistant message
 *  5. Frontend SeatsReviewCarousel shows editable carousel for review
 *  6. review_seats POST action applies accepted cards via officeholders API
 */

import type { TerritorySeatHolder } from '@/lib/ai/resolveTerritoryAnswer';

// ─── Public types ──────────────────────────────────────────────────────────

export type SeatProposal = {
  seat_type: string;
  title: string;
  sub_label?: string | null;
  full_name: string;
  party?: string | null;
  email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  bio?: string | null;
  /** Citation URLs used to research this holder (saved on officeholders.source_urls). */
  source_urls?: string[];
};

export type SeatCardStatus = 'pending' | 'accepted' | 'rejected';

/** One seat for admin review — what's in the DB now vs what the AI proposed. */
export type SeatCompareCard = {
  /** Stable key within this proposal — used for accept/reject decisions. */
  key: string;
  seat_type: string;
  title: string;
  sub_label: string | null;
  /** Current holder full_name in DB, or null if vacant / new seat. */
  existing_name: string | null;
  /** AI-proposed holder data; admin may edit before accepting. */
  proposed: SeatProposal;
  status: SeatCardStatus;
};

// ─── Fence regex ───────────────────────────────────────────────────────────

const SEATS_FENCE_RE = /```ftlom-seats[ \t]*\n([\s\S]*?)\n```/i;
const URL_RE = /https?:\/\/[^\s)\]>'"]+/gi;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Placeholder strings models often emit when a field is unknown. */
const PLACEHOLDER_RE =
  /^(n\/?a|n\.a\.?|none|null|unknown|not\s*available|not\s*found|unavailable|tbd|—|-|–)$/i;

function asTrimmedStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || PLACEHOLDER_RE.test(t)) return null;
  return t;
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

export function normalizeSourceUrls(raw: unknown, max = 12): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v !== 'string') return;
    const n = normalizeUrl(v.trim());
    if (!n || out.includes(n)) return;
    out.push(n);
  };
  if (Array.isArray(raw)) {
    for (const item of raw) push(item);
  } else if (typeof raw === 'string') {
    for (const line of raw.split(/\n|;/)) push(line);
  }
  return out.slice(0, max);
}

/** Collect absolute URLs from prose / citation lists. */
export function extractUrlsFromText(text: string, extra: string[] = [], max = 12): string[] {
  const found = [...text.matchAll(URL_RE)].map((m) => m[0]);
  return normalizeSourceUrls([...found, ...extra], max);
}

function mergeSourceUrls(a?: string[], b?: string[]): string[] {
  return normalizeSourceUrls([...(a ?? []), ...(b ?? [])]);
}

/** Strip N/A / unknown placeholders from a seat proposal so they never fill inputs. */
export function sanitizeSeatProposal(proposal: SeatProposal): SeatProposal {
  return {
    seat_type: asTrimmedStr(proposal.seat_type) ?? proposal.seat_type.trim(),
    title: asTrimmedStr(proposal.title) ?? proposal.title.trim(),
    sub_label: asTrimmedStr(proposal.sub_label ?? undefined),
    full_name: asTrimmedStr(proposal.full_name) ?? proposal.full_name.trim(),
    party: asTrimmedStr(proposal.party ?? undefined),
    email: asTrimmedStr(proposal.email ?? undefined),
    phone: asTrimmedStr(proposal.phone ?? undefined),
    website_url: asTrimmedStr(proposal.website_url ?? undefined),
    bio: asTrimmedStr(proposal.bio ?? undefined),
    source_urls: normalizeSourceUrls(proposal.source_urls),
  };
}

function seatKey(seat_type: string, sub_label: string | null | undefined): string {
  const sl = sub_label?.trim() || '';
  return sl ? `${seat_type}:${sl}` : seat_type;
}

function parseSeatProposal(raw: unknown): SeatProposal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const seat_type = asTrimmedStr(r.seat_type) ?? asTrimmedStr(r.type);
  const title = asTrimmedStr(r.title) ?? asTrimmedStr(r.seat_title) ?? asTrimmedStr(r.seat_type);
  const full_name = asTrimmedStr(r.full_name) ?? asTrimmedStr(r.name);
  if (!seat_type || !full_name) return null;
  return {
    seat_type,
    title: title ?? seat_type,
    sub_label: asTrimmedStr(r.sub_label),
    full_name,
    party: asTrimmedStr(r.party),
    email: asTrimmedStr(r.email),
    phone: asTrimmedStr(r.phone),
    website_url: asTrimmedStr(r.website_url) ?? asTrimmedStr(r.website),
    bio: asTrimmedStr(r.bio),
    source_urls: normalizeSourceUrls(r.source_urls ?? r.sources ?? r.citations),
  };
}

// ─── Extraction ────────────────────────────────────────────────────────────

/**
 * Parse the ```ftlom-seats``` fence from an AI response.
 * Returns cleaned answer text (fence stripped) + proposed seat cards.
 */
export function extractSeatsFromAnswer(answer: string): {
  cleanAnswer: string;
  proposals: SeatProposal[];
  fromBlock: boolean;
} {
  const match = answer.match(SEATS_FENCE_RE);
  if (!match) return { cleanAnswer: answer, proposals: [], fromBlock: false };

  const cleanAnswer = answer.replace(match[0], '').trim();
  try {
    const parsed = JSON.parse(match[1].trim()) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const seatsRaw = Array.isArray(obj.seats) ? obj.seats : [];
      const rootSources = normalizeSourceUrls(obj.source_urls ?? obj.sources);
      const proposals = seatsRaw
        .map(parseSeatProposal)
        .filter((p): p is SeatProposal => p !== null)
        .map((p) => ({
          ...p,
          source_urls: mergeSourceUrls(p.source_urls, rootSources),
        }));
      if (proposals.length > 0) {
        return { cleanAnswer, proposals, fromBlock: true };
      }
    }
  } catch {
    /* fall through — no structured seats */
  }
  return { cleanAnswer, proposals: [], fromBlock: false };
}

/**
 * After enrich: attach prose URLs / OpenAI citations, and backfill bio from the
 * narrative answer when the fence omitted it.
 */
export function applyEnrichmentExtras(
  proposal: SeatProposal,
  cleanAnswer: string,
  citationUrls: string[] = [],
): SeatProposal {
  const urls = extractUrlsFromText(cleanAnswer, [
    ...(proposal.source_urls ?? []),
    ...citationUrls,
    proposal.website_url ?? '',
  ]);
  let bio = proposal.bio ?? null;
  if (!bio && cleanAnswer.trim()) {
    // Prefer the first non-heading paragraph as a short bio.
    const para = cleanAnswer
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .find((p) => p.length >= 40 && !/^#{1,6}\s/.test(p) && !/^sources?\b/i.test(p));
    if (para) bio = para.slice(0, 600);
  }
  return sanitizeSeatProposal({
    ...proposal,
    bio,
    source_urls: urls,
  });
}

// ─── Compare builder ───────────────────────────────────────────────────────

/**
 * Diff proposed seats against current holders in DB.
 * Produces a SeatCompareCard per proposed official.
 * If the proposed name matches the existing holder, the card is still shown
 * so the admin can update other fields (email, website, etc.).
 */
export function buildSeatsCompareCards(
  holders: TerritorySeatHolder[],
  proposals: SeatProposal[],
): SeatCompareCard[] {
  const holderByKey = new Map<string, TerritorySeatHolder>();
  for (const h of holders) {
    holderByKey.set(seatKey(h.seat_type, h.sub_label), h);
  }

  const seen = new Set<string>();
  const cards: SeatCompareCard[] = [];

  for (const p of proposals) {
    const key = seatKey(p.seat_type, p.sub_label);
    if (seen.has(key)) continue; // deduplicate
    seen.add(key);

    const existing = holderByKey.get(key);
    const proposed = sanitizeSeatProposal(p);
    cards.push({
      key,
      seat_type: proposed.seat_type,
      title: proposed.title,
      sub_label: proposed.sub_label ?? null,
      existing_name: existing?.full_name?.trim() || null,
      proposed,
      status: 'pending',
    });
  }

  return cards;
}

// ─── Per-seat enrichment (fill empty detail fields only) ───────────────────

/** Optional holder fields that Enrich may autofill when blank. */
export const SEAT_ENRICH_FIELDS = [
  'party',
  'email',
  'phone',
  'website_url',
  'bio',
] as const;

export type SeatEnrichField = (typeof SEAT_ENRICH_FIELDS)[number];

function fieldEmpty(v: string | null | undefined): boolean {
  return asTrimmedStr(v ?? undefined) == null;
}

/** Which enrichable detail fields are still empty on a draft. */
export function emptySeatDetailFields(proposal: SeatProposal): SeatEnrichField[] {
  const clean = sanitizeSeatProposal(proposal);
  return SEAT_ENRICH_FIELDS.filter((key) => fieldEmpty(clean[key]));
}

/**
 * Merge enrichment into a pending draft — never overwrite a non-empty field.
 * Keeps seat_type / title / sub_label / full_name from the draft unless blank there.
 * Placeholder values like "N/A" are treated as empty and never written.
 * Source URLs are unioned.
 */
export function mergeSeatProposalFillEmpty(
  draft: SeatProposal,
  incoming: SeatProposal,
): { merged: SeatProposal; filled: SeatEnrichField[] } {
  const base = sanitizeSeatProposal(draft);
  const src = sanitizeSeatProposal(incoming);
  const filled: SeatEnrichField[] = [];
  const merged: SeatProposal = {
    seat_type: base.seat_type || src.seat_type,
    title: base.title || src.title,
    sub_label: base.sub_label || src.sub_label || null,
    full_name: base.full_name || src.full_name,
    party: base.party ?? null,
    email: base.email ?? null,
    phone: base.phone ?? null,
    website_url: base.website_url ?? null,
    bio: base.bio ?? null,
    source_urls: mergeSourceUrls(base.source_urls, src.source_urls),
  };

  for (const key of SEAT_ENRICH_FIELDS) {
    if (!fieldEmpty(merged[key])) continue;
    const next = src[key];
    if (fieldEmpty(next)) continue;
    merged[key] = next!;
    filled.push(key);
  }

  return { merged, filled };
}

/** Pick the best matching seat from an enrich response for the pending draft. */
export function matchEnrichProposal(
  draft: SeatProposal,
  proposals: SeatProposal[],
): SeatProposal | null {
  if (proposals.length === 0) return null;
  const key = seatKey(draft.seat_type, draft.sub_label);
  const byKey = proposals.find(
    (p) => seatKey(p.seat_type, p.sub_label) === key,
  );
  if (byKey) return byKey;

  const name = draft.full_name.trim().toLowerCase();
  if (name) {
    const byName = proposals.find((p) => p.full_name.trim().toLowerCase() === name);
    if (byName) return byName;
  }

  return proposals.length === 1 ? proposals[0]! : null;
}
