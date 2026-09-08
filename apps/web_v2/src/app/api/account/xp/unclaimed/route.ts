import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { xpSourceClaimLabel } from '@/features/xp/logic/xpSources';

export const dynamic = 'force-dynamic';

const KIND_LABELS: Record<string, string> = {
  // district: hidden — not product-ready yet
  county: 'County',
  ctu: 'City / township',
  school_district: 'School district',
  // senate_district / house_district: hidden — not product-ready yet
};

export type UnclaimedXpItem = {
  id: string;
  amount: number;
  sourceType: string;
  sourceLabel: string;
  referenceType: string | null;
  referenceId: string | null;
  name: string;
  createdAt: string;
};

/**
 * GET /api/account/xp/unclaimed
 * Rolls up every XP transaction still awaiting a claim (territory_unlock
 * and daily_streak — collect XP is auto-claimed). Backs both the
 * contextual unlock-claim modal and the global XP overlay.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('account_xp_transactions')
      .select('id, amount, source_type, reference_type, reference_id, created_at')
      .eq('account_id', session.accountId)
      .is('claimed_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    const territoryIds = [
      ...new Set(
        rows
          .filter((r) => r.source_type === 'territory_unlock' && r.reference_id)
          .map((r) => r.reference_id as string),
      ),
    ];
    const nameById = new Map<string, string>();
    if (territoryIds.length > 0) {
      const { data: units } = await supabase
        .schema('territory')
        .from('units')
        .select('id, name')
        .in('id', territoryIds);
      for (const u of units ?? []) {
        if (u.id && u.name) nameById.set(u.id as string, u.name as string);
      }
    }

    const items: UnclaimedXpItem[] = rows.map((row) => {
      const referenceType = (row.reference_type as string | null) ?? null;
      const referenceId = (row.reference_id as string | null) ?? null;
      const sourceType = row.source_type as string;
      const claimLabel = xpSourceClaimLabel(sourceType);
      let name = claimLabel;
      if (sourceType === 'territory_unlock' && referenceId) {
        // Hidden kinds (e.g. zipcode) still claimable; no kind label → "Area".
        name = nameById.get(referenceId) ?? KIND_LABELS[referenceType ?? ''] ?? 'Area';
      } else if (sourceType === 'daily_streak' && row.created_at) {
        const when = new Date(row.created_at as string).toLocaleDateString('en-US', {
          timeZone: 'America/Chicago',
          month: 'short',
          day: 'numeric',
        });
        name = `Daily streak · ${when}`;
      }
      return {
        id: row.id as string,
        amount: Number(row.amount) || 0,
        sourceType,
        sourceLabel: claimLabel,
        referenceType,
        referenceId,
        name,
        createdAt: row.created_at as string,
      };
    });

    const total = items.reduce((sum, item) => sum + item.amount, 0);

    return NextResponse.json({ ok: true, total, count: items.length, items });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[account/xp/unclaimed]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
