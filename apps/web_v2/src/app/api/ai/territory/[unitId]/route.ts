import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  applyAcceptedProposal,
  applyUnitFoundationFacts,
} from '@/lib/ai/applyUnitFoundation';
import { aiAccessCanApply, resolveAiAccess } from '@/lib/ai/requireAiAccess';
import { buildEnrichOfficialPrompt } from '@/lib/ai/placeAiTools';
import {
  buildTerritoryLocalAnswer,
  loadTerritoryUnitContext,
} from '@/lib/ai/resolveTerritoryAnswer';
import { runSubjectResponses } from '@/lib/ai/runSubjectResponses';
import { isUuid, SUBJECT_TYPE_TERRITORY_UNIT } from '@/lib/ai/subjectTypes';
import {
  factsFromApprovedRows,
  foundationHasWork,
  isFoundationCompareKey,
  mergeUnitAttrs,
  UNIT_PROFILE_KEYS,
  type FoundationCompareRow,
  type FoundationRowStatus,
  type UnitAttrsPatch,
} from '@/lib/ai/unitProfileFacts';
import {
  applyEnrichmentExtras,
  emptySeatDetailFields,
  extractSeatsFromAnswer,
  matchEnrichProposal,
  mergeSeatProposalFillEmpty,
  normalizeSourceUrls,
  sanitizeSeatProposal,
  type SeatCompareCard,
  type SeatCardStatus,
  type SeatProposal,
} from '@/lib/ai/unitSeatsFacts';
import { createAiServerClient } from '@/lib/supabase/aiDb';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/territory/[unitId]
 * Unit profile + seat summary for the AI dock.
 * Prod: staff/admin only; others get comingSoon.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitId: string }> },
) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const { unitId } = await params;
    if (!isUuid(unitId)) {
      return NextResponse.json({ error: 'Invalid unit id' }, { status: 400 });
    }

    const { unit, holders } = await loadTerritoryUnitContext(unitId);
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    return NextResponse.json({
      comingSoon: false,
      unit,
      holders,
      holderCount: holders.filter((h) => h.full_name?.trim()).length,
      seatCount: holders.length,
    });
  } catch (err) {
    console.error('[ai/territory GET]', err);
    return NextResponse.json({ error: 'Failed to load territory AI context' }, { status: 500 });
  }
}

type PostBody = {
  action?:
    | 'ask'
    | 'propose_profile'
    | 'propose_attrs'
    | 'accept_proposal'
    | 'review_foundation'
    | 'review_seats'
    | 'enrich_seat';
  message?: string;
  proposal?: {
    kind?: string;
    payload?: Record<string, unknown>;
  };
  proposalId?: string;
  /** Assistant message that holds foundation compare rows or seat cards. */
  messageId?: string;
  /** Line-by-line accept/reject for Existing vs New (foundation or seats). */
  decisions?: Array<{ key?: string; decision?: 'accept' | 'reject'; proposed?: SeatProposal }>;
  /** Pending seat draft for enrich_seat (pre-save autofill). */
  seat?: SeatProposal;
};

/**
 * POST /api/ai/territory/[unitId]
 * Localhost or staff/admin: ask, propose_profile, propose_attrs,
 * accept_proposal, review_foundation, review_seats, enrich_seat
 * (per-pending-card empty-field search before save).
 *
 * @see docs/place-ai-foundation.md
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> },
) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const { unitId } = await params;
    if (!isUuid(unitId)) {
      return NextResponse.json({ error: 'Invalid unit id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const action = body.action ?? 'ask';
    const session = await getSessionAccount();

    if (action === 'ask') {
      const message = body.message?.trim() ?? '';
      if (!message) {
        return NextResponse.json({ error: 'message required' }, { status: 400 });
      }
      const { unit, holders } = await loadTerritoryUnitContext(unitId);
      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      }
      const answer = buildTerritoryLocalAnswer(unit, holders, message);
      return NextResponse.json({
        answer,
        unit: { id: unit.id, name: unit.name },
        holderCount: holders.filter((h) => h.full_name?.trim()).length,
      });
    }

    if (action === 'propose_profile') {
      if (!session) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
      const payload = body.proposal?.payload ?? {};
      const patch: Record<string, string> = {};
      for (const key of UNIT_PROFILE_KEYS) {
        const v = payload[key];
        if (typeof v === 'string' && v.trim()) patch[key] = v.trim();
      }
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'No profile fields to propose' }, { status: 400 });
      }

      const db = createTerritoryServerClient();
      const { data: proposal, error } = await db
        .from('change_proposals')
        .insert({
          unit_id: unitId,
          proposed_by_account_id: session.accountId,
          kind: 'update_unit_profile',
          payload: patch,
          status: 'open',
        })
        .select('id, kind, payload, status, created_at')
        .single();

      if (error) {
        console.error('[ai/territory propose]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const applied = await applyAcceptedProposal({
        unitId,
        kind: 'update_unit_profile',
        payload: patch,
      });
      if (applied.ok) {
        await db
          .from('change_proposals')
          .update({
            status: 'accepted',
            reviewed_by_account_id: session.accountId,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', proposal.id);
      }

      return NextResponse.json({
        proposal: { ...proposal, status: applied.ok ? 'accepted' : 'open' },
        applied: applied.ok,
      });
    }

    if (action === 'propose_attrs') {
      if (!session) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
      const payload = body.proposal?.payload ?? {};
      const attrsPatch: UnitAttrsPatch = {};
      if (typeof payload.population === 'number' && payload.population > 0) {
        attrsPatch.population = Math.round(payload.population);
      }
      const features = payload.features;
      if (features && typeof features === 'object' && !Array.isArray(features)) {
        const f = features as Record<string, unknown>;
        const best = Array.isArray(f.best)
          ? f.best
              .filter((x): x is string => typeof x === 'string')
              .map((x) => x.trim())
              .filter(Boolean)
          : [];
        const worst = Array.isArray(f.worst)
          ? f.worst
              .filter((x): x is string => typeof x === 'string')
              .map((x) => x.trim())
              .filter(Boolean)
          : [];
        if (best.length || worst.length) {
          attrsPatch.features = {};
          if (best.length) attrsPatch.features.best = best.slice(0, 8);
          if (worst.length) attrsPatch.features.worst = worst.slice(0, 8);
        }
      }
      if (
        attrsPatch.population == null &&
        !attrsPatch.features?.best?.length &&
        !attrsPatch.features?.worst?.length
      ) {
        return NextResponse.json({ error: 'No attrs fields to propose' }, { status: 400 });
      }

      const db = createTerritoryServerClient();
      const { data: proposal, error } = await db
        .from('change_proposals')
        .insert({
          unit_id: unitId,
          proposed_by_account_id: session.accountId,
          kind: 'update_unit_attrs',
          payload: { ...attrsPatch },
          status: 'open',
        })
        .select('id, kind, payload, status, created_at')
        .single();

      if (error) {
        console.error('[ai/territory propose attrs]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { data: unitRow } = await db
        .from('units')
        .select('attrs')
        .eq('id', unitId)
        .maybeSingle();
      const merged = mergeUnitAttrs(
        (unitRow?.attrs as Record<string, unknown>) ?? {},
        attrsPatch,
      );
      const { error: applyErr } = await db
        .from('units')
        .update({ attrs: merged })
        .eq('id', unitId);

      if (!applyErr) {
        await db
          .from('change_proposals')
          .update({
            status: 'accepted',
            reviewed_by_account_id: session.accountId,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', proposal.id);
      }

      return NextResponse.json({
        proposal: { ...proposal, status: applyErr ? 'open' : 'accepted' },
        applied: !applyErr,
      });
    }

    if (action === 'accept_proposal') {
      if (!session) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
      const proposalId = body.proposalId;
      if (!isUuid(proposalId)) {
        return NextResponse.json({ error: 'proposalId required' }, { status: 400 });
      }
      const db = createTerritoryServerClient();
      const { data: proposal, error } = await db
        .from('change_proposals')
        .select('id, unit_id, kind, payload, status')
        .eq('id', proposalId)
        .eq('unit_id', unitId)
        .maybeSingle();
      if (error || !proposal) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }
      if (proposal.status !== 'open') {
        return NextResponse.json({ error: 'Proposal already reviewed' }, { status: 409 });
      }

      const applied = await applyAcceptedProposal({
        unitId,
        kind: proposal.kind as string,
        payload: (proposal.payload ?? {}) as Record<string, unknown>,
      });
      if (!applied.ok) {
        return NextResponse.json({ error: applied.error }, { status: 500 });
      }

      await db
        .from('change_proposals')
        .update({
          status: 'accepted',
          reviewed_by_account_id: session.accountId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', proposalId);

      return NextResponse.json({ ok: true });
    }

    if (action === 'review_foundation') {
      if (!session) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
      if (!aiAccessCanApply(access)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const messageId = body.messageId;
      if (!isUuid(messageId)) {
        return NextResponse.json({ error: 'messageId required' }, { status: 400 });
      }
      const decisions = Array.isArray(body.decisions) ? body.decisions : [];
      if (decisions.length === 0) {
        return NextResponse.json({ error: 'decisions required' }, { status: 400 });
      }

      const ai = createAiServerClient();
      const { data: message, error: msgErr } = await ai
        .from('subject_messages')
        .select('id, thread_id, role, meta')
        .eq('id', messageId)
        .maybeSingle();
      if (msgErr || !message || message.role !== 'assistant') {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const { data: thread, error: threadErr } = await ai
        .from('subject_threads')
        .select('id, account_id, subject_type, subject_id')
        .eq('id', message.thread_id as string)
        .maybeSingle();
      if (threadErr || !thread) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
      if (thread.account_id !== session.accountId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (
        thread.subject_type !== SUBJECT_TYPE_TERRITORY_UNIT ||
        thread.subject_id !== unitId
      ) {
        return NextResponse.json({ error: 'Message is not for this place' }, { status: 400 });
      }

      const meta = (message.meta ?? {}) as Record<string, unknown>;
      const foundation = (meta.foundation ?? {}) as Record<string, unknown>;
      const rowsRaw = Array.isArray(foundation.rows) ? foundation.rows : [];
      if (rowsRaw.length === 0) {
        return NextResponse.json({ error: 'No foundation rows to review' }, { status: 400 });
      }

      const rows: FoundationCompareRow[] = rowsRaw.map((raw) => {
        const r = raw as FoundationCompareRow;
        return {
          ...r,
          status: (r.status ?? 'pending') as FoundationRowStatus,
        };
      });

      const decisionByKey = new Map<string, 'accept' | 'reject'>();
      for (const d of decisions) {
        if (!isFoundationCompareKey(d.key)) continue;
        if (d.decision !== 'accept' && d.decision !== 'reject') continue;
        decisionByKey.set(d.key, d.decision);
      }
      if (decisionByKey.size === 0) {
        return NextResponse.json({ error: 'No valid decisions' }, { status: 400 });
      }

      const nextRows = rows.map((row) => {
        const decision = decisionByKey.get(row.key);
        if (!decision || row.status !== 'pending') return row;
        return {
          ...row,
          status: (decision === 'accept' ? 'accepted' : 'rejected') as FoundationRowStatus,
        };
      });

      const sourceUrls = Array.isArray(foundation.source_urls)
        ? foundation.source_urls.filter((u): u is string => typeof u === 'string')
        : [];
      const facts = factsFromApprovedRows(
        nextRows.filter((r) => decisionByKey.get(r.key) === 'accept'),
        sourceUrls,
      );

      let proposalIds = Array.isArray(foundation.proposal_ids)
        ? foundation.proposal_ids.filter((id): id is string => typeof id === 'string')
        : [];
      let justApplied = false;

      if (foundationHasWork(facts)) {
        const applied = await applyUnitFoundationFacts({
          unitId,
          accountId: session.accountId,
          facts,
          messageId,
          autoApply: true,
        });
        justApplied = applied.applied;
        if (applied.proposalIds.length) {
          proposalIds = [...new Set([...proposalIds, ...applied.proposalIds])];
        }
        if (!applied.applied) {
          return NextResponse.json(
            { error: 'Could not apply approved fields' },
            { status: 500 },
          );
        }
      }

      const pendingLeft = nextRows.some((r) => r.status === 'pending');
      const acceptedAny = nextRows.some((r) => r.status === 'accepted');
      const status = pendingLeft
        ? 'pending'
        : acceptedAny
          ? 'applied'
          : 'dismissed';

      const nextFoundation = {
        ...foundation,
        rows: nextRows,
        labels: nextRows.filter((r) => r.status === 'accepted').map((r) => r.label),
        proposal_ids: proposalIds,
        applied: acceptedAny || Boolean(foundation.applied),
        status,
        last_reviewed_at: new Date().toISOString(),
      };
      const nextMeta = { ...meta, foundation: nextFoundation };

      const { data: patched, error: patchErr } = await ai
        .from('subject_messages')
        .update({ meta: nextMeta })
        .eq('id', messageId)
        .select('id, role, content, meta, created_at')
        .single();
      if (patchErr || !patched) {
        return NextResponse.json(
          { error: patchErr?.message ?? 'Failed to update review state' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        applied: justApplied,
        foundation: nextFoundation,
        message: patched,
      });
    }

    if (action === 'enrich_seat') {
      if (!session) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
      if (!aiAccessCanApply(access)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const seatRaw = body.seat;
      if (!seatRaw || typeof seatRaw !== 'object') {
        return NextResponse.json({ error: 'seat required' }, { status: 400 });
      }
      const draft = sanitizeSeatProposal({
        seat_type: String(seatRaw.seat_type ?? '').trim(),
        title: String(seatRaw.title ?? '').trim(),
        sub_label:
          typeof seatRaw.sub_label === 'string' ? seatRaw.sub_label.trim() || null : null,
        full_name: String(seatRaw.full_name ?? '').trim(),
        party: typeof seatRaw.party === 'string' ? seatRaw.party.trim() || null : null,
        email: typeof seatRaw.email === 'string' ? seatRaw.email.trim() || null : null,
        phone: typeof seatRaw.phone === 'string' ? seatRaw.phone.trim() || null : null,
        website_url:
          typeof seatRaw.website_url === 'string'
            ? seatRaw.website_url.trim() || null
            : null,
        bio: typeof seatRaw.bio === 'string' ? seatRaw.bio.trim() || null : null,
        source_urls: normalizeSourceUrls(
          (seatRaw as { source_urls?: unknown }).source_urls,
        ),
      });
      if (!draft.full_name || !draft.seat_type) {
        return NextResponse.json(
          { error: 'seat.full_name and seat.seat_type are required' },
          { status: 400 },
        );
      }

      const emptyFields = emptySeatDetailFields(draft);

      const { unit } = await loadTerritoryUnitContext(unitId);
      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      }

      const typeLabel = (() => {
        const k = unit.kind.trim().toLowerCase();
        const s = (unit.subtype ?? '').trim().toLowerCase();
        if (k === 'ctu') {
          if (s === 'city') return 'city';
          if (s === 'township' || s === 'town') return 'township';
          return 'city or township';
        }
        if (k === 'county') return 'county';
        if (k === 'school_district') return 'school district';
        if (k === 'district') return 'congressional district';
        if (k === 'senate_district') return 'senate district';
        if (k === 'house_district') return 'house district';
        if (k === 'zipcode') return 'ZIP code';
        return k.replace(/_/g, ' ') || 'place';
      })();

      const prompt = buildEnrichOfficialPrompt({
        placeName: unit.name,
        typeLabel,
        draft,
        emptyFields: [...emptyFields],
      });

      const result = await runSubjectResponses({
        subjectType: SUBJECT_TYPE_TERRITORY_UNIT,
        subjectId: unitId,
        userMessage: prompt,
        placeTool: 'fill_officials',
      });

      const { proposals, cleanAnswer } = extractSeatsFromAnswer(result.answer);
      const citationUrls = result.citations.map((c) => c.url);
      const answerText = cleanAnswer || result.answer;
      const matchedRaw = matchEnrichProposal(draft, proposals);
      // Even without a fence match, salvage URLs / bio from the narrative answer.
      const matched = applyEnrichmentExtras(
        matchedRaw ?? {
          seat_type: draft.seat_type,
          title: draft.title,
          sub_label: draft.sub_label,
          full_name: draft.full_name,
        },
        answerText,
        citationUrls,
      );

      const { merged, filled } = mergeSeatProposalFillEmpty(draft, matched);
      const sourcesAdded =
        (merged.source_urls?.length ?? 0) - (draft.source_urls?.length ?? 0);

      return NextResponse.json({
        proposed: merged,
        filled,
        emptyFields: emptySeatDetailFields(merged),
        sources_added: Math.max(0, sourcesAdded),
        prompt,
        answer: answerText,
        resolver: result.resolver,
        web_search_used: result.web_search_used,
        message:
          matchedRaw || filled.length || sourcesAdded > 0
            ? undefined
            : 'No structured seat details found — try again or fill fields manually.',
      });
    }

    if (action === 'review_seats') {
      if (!session) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
      if (!aiAccessCanApply(access)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const messageId = body.messageId;
      if (!isUuid(messageId)) {
        return NextResponse.json({ error: 'messageId required' }, { status: 400 });
      }
      const decisions = Array.isArray(body.decisions) ? body.decisions : [];
      if (decisions.length === 0) {
        return NextResponse.json({ error: 'decisions required' }, { status: 400 });
      }

      const ai = createAiServerClient();
      const { data: message, error: msgErr } = await ai
        .from('subject_messages')
        .select('id, thread_id, role, meta')
        .eq('id', messageId)
        .maybeSingle();
      if (msgErr || !message || message.role !== 'assistant') {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const { data: thread, error: threadErr } = await ai
        .from('subject_threads')
        .select('id, account_id, subject_type, subject_id')
        .eq('id', message.thread_id as string)
        .maybeSingle();
      if (threadErr || !thread) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
      if (thread.account_id !== session.accountId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (
        thread.subject_type !== SUBJECT_TYPE_TERRITORY_UNIT ||
        thread.subject_id !== unitId
      ) {
        return NextResponse.json({ error: 'Message is not for this place' }, { status: 400 });
      }

      const meta = (message.meta ?? {}) as Record<string, unknown>;
      const seatsMeta = (meta.seats ?? {}) as Record<string, unknown>;
      const cardsRaw = Array.isArray(seatsMeta.cards) ? seatsMeta.cards : [];
      if (cardsRaw.length === 0) {
        return NextResponse.json({ error: 'No seat cards to review' }, { status: 400 });
      }

      const cards = cardsRaw as SeatCompareCard[];
      const decisionMap = new Map<string, { decision: 'accept' | 'reject'; proposed?: SeatProposal }>();
      for (const d of decisions) {
        if (!d.key || (d.decision !== 'accept' && d.decision !== 'reject')) continue;
        decisionMap.set(d.key, { decision: d.decision, proposed: d.proposed });
      }

      const db = createTerritoryServerClient();
      const UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const errors: string[] = [];

      const nextCards = await Promise.all(
        cards.map(async (card) => {
          const d = decisionMap.get(card.key);
          if (!d || card.status !== 'pending') return card;
          if (d.decision === 'reject') return { ...card, status: 'rejected' as SeatCardStatus };

          // Apply accepted card — upsert seat + officeholder.
          const proposed = sanitizeSeatProposal(d.proposed ?? card.proposed);
          const name = proposed.full_name?.trim();
          if (!name) {
            errors.push(`${card.title}: name required`);
            return card;
          }

          try {
            // Find or create seat by (unit_id, seat_type, sub_label).
            const seatType = proposed.seat_type.trim();
            const seatTitle = proposed.title?.trim() || seatType;
            const subLabel = proposed.sub_label?.trim() || null;

            const { data: upserted, error: seatErr } = await db
              .from('seats')
              .upsert(
                {
                  unit_id: unitId,
                  seat_type: seatType,
                  title: seatTitle,
                  sub_label: subLabel,
                  is_active: true,
                  is_elected: true,
                },
                { onConflict: 'unit_id,seat_type,sub_label' },
              )
              .select('id')
              .single();

            if (seatErr || !upserted) {
              errors.push(`${card.title}: seat upsert failed`);
              return card;
            }
            const seatId = upserted.id as string;
            if (!UUID_RE.test(seatId)) {
              errors.push(`${card.title}: invalid seat id`);
              return card;
            }

            // Retire previous current holder.
            await db
              .from('officeholders')
              .update({ is_current: false })
              .eq('seat_id', seatId)
              .eq('is_current', true);

            // Insert new holder.
            const { error: holderErr } = await db.from('officeholders').insert({
              seat_id: seatId,
              full_name: name,
              party: proposed.party?.trim() || null,
              email: proposed.email?.trim() || null,
              phone: proposed.phone?.trim() || null,
              website_url: proposed.website_url?.trim() || null,
              bio: proposed.bio?.trim() || null,
              source_urls: normalizeSourceUrls(proposed.source_urls),
              is_current: true,
            });

            if (holderErr) {
              errors.push(`${card.title}: holder insert failed`);
              return card;
            }

            return { ...card, status: 'accepted' as SeatCardStatus };
          } catch {
            errors.push(`${card.title}: unexpected error`);
            return card;
          }
        }),
      );

      const pendingLeft = nextCards.some((c) => c.status === 'pending');
      const acceptedAny = nextCards.some((c) => c.status === 'accepted');
      const status = pendingLeft ? 'pending' : acceptedAny ? 'applied' : 'dismissed';

      const nextSeatsMeta = {
        ...seatsMeta,
        cards: nextCards,
        applied: acceptedAny || Boolean(seatsMeta.applied),
        status,
        last_reviewed_at: new Date().toISOString(),
      };
      const nextMeta = { ...meta, seats: nextSeatsMeta };

      const { data: patched, error: patchErr } = await ai
        .from('subject_messages')
        .update({ meta: nextMeta })
        .eq('id', messageId)
        .select('id, role, content, meta, created_at')
        .single();
      if (patchErr || !patched) {
        return NextResponse.json(
          { error: patchErr?.message ?? 'Failed to update review state' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        applied: acceptedAny,
        seats: nextSeatsMeta,
        message: patched,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[ai/territory POST]', err);
    return NextResponse.json({ error: 'Place AI request failed' }, { status: 500 });
  }
}
