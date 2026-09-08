import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { getWalletServiceDb } from '@/lib/wallet/walletDb';
import {
  ensureMonthlyToolCredits,
  getToolCreditsBalance,
  type WalletTransactionRow,
} from '@/lib/wallet/walletLedger';

function fallbackLabel(row: WalletTransactionRow): string {
  switch (row.type) {
    case 'plan_grant':
      return 'Monthly plan credits';
    case 'admin_grant':
      return 'Credit grant';
    case 'purchase':
      return 'Credit purchase';
    case 'refund':
      return 'Refund';
    case 'reward':
      if (row.action === 'collect') return 'Map credit';
      return 'Reward';
    case 'spend':
      if (row.product === 'real-estate') {
        return row.action === 'owner' ? 'Owner / skip trace' : 'Property lookup';
      }
      if (row.product === 'news') return 'News search';
      return 'People lookup';
    default:
      return 'Adjustment';
  }
}

function capitalize(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/**
 * GET /api/wallet/summary
 * Balance, monthly usage, and recent ledger for the signed-in tool-credits purse.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entitlement = await ensureMonthlyToolCredits(session.accountId);
    const balance = entitlement.isUnlimited
      ? null
      : await getToolCreditsBalance(session.accountId);

    const walletDb = getWalletServiceDb();
    const baseFilter = () =>
      walletDb
        .from('transactions')
        .select(
          'id, amount, type, product, action, description, created_at, reference_type, reference_id',
        )
        .eq('owner_type', 'account')
        .eq('owner_id', session.accountId)
        .eq('purse', 'tool_credits');

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString();
    const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [
      { data: recentRows, error: recentError },
      { data: monthRows, error: monthError },
      { data: earnedRows, error: earnedError },
    ] = await Promise.all([
      baseFilter().order('created_at', { ascending: false }).limit(25),
      baseFilter().in('type', ['spend', 'refund']).gte('created_at', monthStart),
      // Lifetime inflows — platform (plan / purchase) vs collected (map rewards).
      walletDb
        .from('transactions')
        .select('amount, type')
        .eq('owner_type', 'account')
        .eq('owner_id', session.accountId)
        .eq('purse', 'tool_credits')
        .in('type', ['plan_grant', 'purchase', 'admin_grant', 'reward'])
        .gt('amount', 0)
        .limit(5000),
    ]);

    if (recentError || monthError || earnedError) {
      throw new Error(
        (recentError ?? monthError ?? earnedError)?.message ?? 'Wallet query failed',
      );
    }

    const usedThisMonth = Math.max(
      0,
      -((monthRows as WalletTransactionRow[] | null) ?? []).reduce((sum, r) => sum + r.amount, 0),
    );

    let earnedPlatform = 0;
    let earnedCollected = 0;
    for (const row of (earnedRows as { amount: number; type: string }[] | null) ?? []) {
      if (row.type === 'reward') earnedCollected += row.amount;
      else earnedPlatform += row.amount;
    }

    const transactions = ((recentRows as WalletTransactionRow[] | null) ?? []).map((row) => ({
      id: row.id,
      amount: row.amount,
      type: row.type,
      product: row.product,
      action: row.action,
      label: row.description?.trim() || fallbackLabel(row),
      createdAt: row.created_at,
      referenceType: row.reference_type ?? null,
      referenceId: row.reference_id ?? null,
      /** Spends can open the tool result sheet. */
      canOpenResult: row.type === 'spend',
    }));

    return NextResponse.json({
      balance,
      isUnlimited: entitlement.isUnlimited,
      monthlyGrant: entitlement.monthlyGrant,
      usedThisMonth,
      planLabel: capitalize(entitlement.planSlug),
      resetsOn: nextReset.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      earned: {
        platform: earnedPlatform,
        collected: earnedCollected,
        total: earnedPlatform + earnedCollected,
      },
      transactions,
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('GET /api/wallet/summary:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
