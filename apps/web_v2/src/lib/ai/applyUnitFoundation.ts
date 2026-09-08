import {
  foundationFieldLabels,
  foundationHasWork,
  mergeUnitAttrs,
  type UnitAttrsPatch,
  type UnitFoundationFacts,
  type UnitProfilePatch,
  UNIT_PROFILE_KEYS,
} from '@/lib/ai/unitProfileFacts';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export type FoundationApplyResult = {
  applied: boolean;
  labels: string[];
  proposalIds: string[];
};

function profilePayload(patch: UnitProfilePatch): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of UNIT_PROFILE_KEYS) {
    const v = patch[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  return out;
}

function attrsPayload(patch: UnitAttrsPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.population != null) out.population = patch.population;
  if (patch.features) {
    const features: Record<string, unknown> = {};
    if (patch.features.best?.length) features.best = patch.features.best;
    if (patch.features.worst?.length) features.worst = patch.features.worst;
    if (Object.keys(features).length) out.features = features;
  }
  return out;
}

/**
 * Persist foundation facts as change_proposals and apply immediately when autoApply
 * (localhost or staff/admin Place AI access).
 * Profile → columns; attrs → deep-merge into units.attrs.
 */
export async function applyUnitFoundationFacts(input: {
  unitId: string;
  accountId: string;
  facts: UnitFoundationFacts;
  messageId?: string;
  autoApply?: boolean;
}): Promise<FoundationApplyResult> {
  const empty: FoundationApplyResult = { applied: false, labels: [], proposalIds: [] };
  if (!foundationHasWork(input.facts)) return empty;

  const db = createTerritoryServerClient();
  const labels = foundationFieldLabels(input.facts);
  const proposalIds: string[] = [];
  const sourceMeta = {
    source_urls: input.facts.source_urls,
    message_id: input.messageId ?? null,
    origin: 'subject-chat-extract',
  };

  const profile = profilePayload(input.facts.profile);
  if (Object.keys(profile).length > 0) {
    const { data, error } = await db
      .from('change_proposals')
      .insert({
        unit_id: input.unitId,
        proposed_by_account_id: input.accountId,
        kind: 'update_unit_profile',
        payload: { ...profile, ...sourceMeta },
        status: 'open',
      })
      .select('id')
      .single();
    if (error) {
      console.error('[applyUnitFoundation profile proposal]', error);
    } else if (data?.id) {
      proposalIds.push(data.id as string);
    }
  }

  const attrsPatch = attrsPayload(input.facts.attrs);
  if (Object.keys(attrsPatch).length > 0) {
    const { data, error } = await db
      .from('change_proposals')
      .insert({
        unit_id: input.unitId,
        proposed_by_account_id: input.accountId,
        kind: 'update_unit_attrs',
        payload: { ...attrsPatch, ...sourceMeta },
        status: 'open',
      })
      .select('id')
      .single();
    if (error) {
      console.error('[applyUnitFoundation attrs proposal]', error);
    } else if (data?.id) {
      proposalIds.push(data.id as string);
    }
  }

  if (proposalIds.length === 0) return empty;

  if (!input.autoApply) {
    return { applied: false, labels, proposalIds };
  }

  let applied = true;

  if (Object.keys(profile).length > 0) {
    const { error } = await db.from('units').update(profile).eq('id', input.unitId);
    if (error) {
      console.error('[applyUnitFoundation profile apply]', error);
      applied = false;
    }
  }

  if (Object.keys(attrsPatch).length > 0) {
    const { data: unitRow, error: loadErr } = await db
      .from('units')
      .select('attrs')
      .eq('id', input.unitId)
      .maybeSingle();
    if (loadErr || !unitRow) {
      console.error('[applyUnitFoundation attrs load]', loadErr);
      applied = false;
    } else {
      const existing = (unitRow.attrs as Record<string, unknown>) ?? {};
      const merged = mergeUnitAttrs(existing, input.facts.attrs);
      const { error } = await db
        .from('units')
        .update({ attrs: merged })
        .eq('id', input.unitId);
      if (error) {
        console.error('[applyUnitFoundation attrs apply]', error);
        applied = false;
      }
    }
  }

  if (applied) {
    await db
      .from('change_proposals')
      .update({
        status: 'accepted',
        reviewed_by_account_id: input.accountId,
        reviewed_at: new Date().toISOString(),
      })
      .in('id', proposalIds);
  }

  return { applied, labels, proposalIds };
}

/** Apply an accepted proposal payload to units (shared by territory API). */
export async function applyAcceptedProposal(input: {
  unitId: string;
  kind: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createTerritoryServerClient();

  if (input.kind === 'update_unit_profile') {
    const patch: Record<string, string> = {};
    for (const key of UNIT_PROFILE_KEYS) {
      const v = input.payload[key];
      if (typeof v === 'string') patch[key] = v;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await db.from('units').update(patch).eq('id', input.unitId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  if (input.kind === 'update_unit_attrs') {
    const attrsPatch: UnitAttrsPatch = {};
    if (typeof input.payload.population === 'number') {
      attrsPatch.population = input.payload.population;
    }
    const features = input.payload.features;
    if (features && typeof features === 'object' && !Array.isArray(features)) {
      const f = features as Record<string, unknown>;
      attrsPatch.features = {
        best: Array.isArray(f.best)
          ? f.best.filter((x): x is string => typeof x === 'string')
          : undefined,
        worst: Array.isArray(f.worst)
          ? f.worst.filter((x): x is string => typeof x === 'string')
          : undefined,
      };
    }
    const { data: unitRow, error: loadErr } = await db
      .from('units')
      .select('attrs')
      .eq('id', input.unitId)
      .maybeSingle();
    if (loadErr || !unitRow) {
      return { ok: false, error: loadErr?.message ?? 'Unit not found' };
    }
    const merged = mergeUnitAttrs(
      (unitRow.attrs as Record<string, unknown>) ?? {},
      attrsPatch,
    );
    const { error } = await db
      .from('units')
      .update({ attrs: merged })
      .eq('id', input.unitId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  return { ok: false, error: `Unsupported proposal kind: ${input.kind}` };
}
