/**
 * Tool-credits ledger on `wallet` — foundation for ios-2 contact-book tools.
 * Same purse / RPC contract as apps/ios (`tool_credits` on account owners).
 */
import { getPublicServiceDb, getWalletServiceDb } from '@/lib/wallet/walletDb';

const OWNER_TYPE_ACCOUNT = 'account';
const PURSE_TOOL_CREDITS = 'tool_credits';

export const TOOL_CREDITS_FEATURE_SLUG = 'tool_credits_monthly';

export type WalletTransactionRow = {
  id: string;
  amount: number;
  type: string;
  product: string | null;
  action: string | null;
  description: string | null;
  created_at: string;
  reference_type?: string | null;
  reference_id?: string | null;
};

export type ToolCreditsEntitlement = {
  planSlug: string;
  monthlyGrant: number;
  isUnlimited: boolean;
};

export type ToolProduct = 'find-people' | 'real-estate' | 'news';

/** Safe, non-PII ledger labels — never put names/emails/phones/addresses here. */
export const TOOL_LEDGER_LABELS = {
  peoplePublicRecords: 'Public records search',
  peoplePersonDetail: 'Person detail pull',
  realEstateProperty: 'Property details lookup',
  realEstateOwner: 'Owner / skip-trace lookup',
  newsSearch: 'News search',
  refundSuffix: ' — refunded',
} as const;

export type ChargeToolCreditsInput = {
  accountId: string;
  product: ToolProduct;
  action: string;
  cost: number;
  description?: string;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
};

export type ChargeResult =
  | { ok: true; transactionId: string | null; charged: number }
  | { ok: false; reason: 'insufficient_credits' };

function currentYearMonthUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toWalletError(context: string, error: { message?: string; code?: string }): Error {
  const msg = error.message?.trim() || error.code || 'Wallet database error';
  return new Error(`${context}: ${msg}`);
}

function isInsufficientCredits(error: { message?: string; code?: string }): boolean {
  return Boolean(error.message?.includes('insufficient_credits') || error.code === 'P0001');
}

export async function getToolCreditsBalance(accountId: string): Promise<number> {
  const db = getWalletServiceDb();
  const { data, error } = await db.rpc('balance', {
    p_owner_type: OWNER_TYPE_ACCOUNT,
    p_owner_id: accountId,
    p_purse: PURSE_TOOL_CREDITS,
  });
  if (error) throw toWalletError('wallet.balance', error);
  if (typeof data === 'number') return data;
  const parsed = Number.parseInt(String(data ?? 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type RecordTransactionInput = {
  accountId: string;
  amount: number;
  type: 'plan_grant' | 'admin_grant' | 'purchase' | 'spend' | 'refund' | 'adjustment' | 'reward';
  product?: string | null;
  action?: string | null;
  description?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
};

export async function recordToolCreditTransaction(
  input: RecordTransactionInput,
): Promise<WalletTransactionRow> {
  const db = getWalletServiceDb();
  const { data, error } = await db.rpc('record_transaction', {
    p_owner_type: OWNER_TYPE_ACCOUNT,
    p_owner_id: input.accountId,
    p_purse: PURSE_TOOL_CREDITS,
    p_amount: input.amount,
    p_type: input.type,
    p_product: input.product ?? null,
    p_action: input.action ?? null,
    p_description: input.description ?? null,
    p_created_by_account_id: input.accountId,
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) {
    if (isInsufficientCredits(error)) {
      const err = new Error('insufficient_credits');
      (err as Error & { code: string }).code = 'insufficient_credits';
      throw err;
    }
    throw toWalletError('wallet.record_transaction', error);
  }
  return data as WalletTransactionRow;
}

export async function getToolCreditsEntitlement(accountId: string): Promise<ToolCreditsEntitlement> {
  const publicDb = getPublicServiceDb();
  const { data: account } = await publicDb
    .from('accounts')
    .select('plan')
    .eq('id', accountId)
    .maybeSingle();
  const planSlug = (account as { plan?: string } | null)?.plan ?? 'hobby';

  const { data, error } = await publicDb.rpc('get_account_feature_limit_internal', {
    p_account_id: accountId,
    p_feature_slug: TOOL_CREDITS_FEATURE_SLUG,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { planSlug, monthlyGrant: 0, isUnlimited: false };
  }

  const row = data[0] as {
    limit_value?: number | null;
    is_unlimited?: boolean;
  };

  return {
    planSlug,
    monthlyGrant: typeof row.limit_value === 'number' ? row.limit_value : 0,
    isUnlimited: Boolean(row.is_unlimited),
  };
}

/** Grant this month's plan credits if not already granted (idempotent per UTC month). */
export async function ensureMonthlyToolCredits(accountId: string): Promise<ToolCreditsEntitlement> {
  const entitlement = await getToolCreditsEntitlement(accountId);
  if (entitlement.isUnlimited || entitlement.monthlyGrant <= 0) {
    return entitlement;
  }
  const yearMonth = currentYearMonthUtc();
  await recordToolCreditTransaction({
    accountId,
    amount: entitlement.monthlyGrant,
    type: 'plan_grant',
    description: `Monthly ${entitlement.planSlug} tool credits (${yearMonth})`,
    idempotencyKey: `plan_grant:tool_credits:${accountId}:${yearMonth}`,
  });
  return entitlement;
}

export async function chargeToolCredits(input: ChargeToolCreditsInput): Promise<ChargeResult> {
  const entitlement = await ensureMonthlyToolCredits(input.accountId);
  if (entitlement.isUnlimited || input.cost <= 0) {
    return { ok: true, transactionId: null, charged: 0 };
  }
  try {
    const row = await recordToolCreditTransaction({
      accountId: input.accountId,
      amount: -input.cost,
      type: 'spend',
      product: input.product,
      action: input.action,
      description: input.description ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    });
    return { ok: true, transactionId: row.id, charged: input.cost };
  } catch (e) {
    if ((e as Error & { code?: string }).code === 'insufficient_credits') {
      return { ok: false, reason: 'insufficient_credits' };
    }
    throw e;
  }
}

export async function linkSpendToLookup(input: {
  spendTransactionId: string;
  lookupId: string;
}): Promise<void> {
  const db = getWalletServiceDb();
  const { error } = await db
    .from('transactions')
    .update({
      reference_type: 'tool_lookup',
      reference_id: input.lookupId,
    })
    .eq('id', input.spendTransactionId)
    .eq('type', 'spend');
  if (error) throw toWalletError('wallet.linkSpendToLookup', error);
}

export async function refundToolCredits(input: {
  accountId: string;
  spendTransactionId: string;
  cost: number;
  product: ToolProduct;
  action: string;
  description?: string;
}): Promise<void> {
  if (input.cost <= 0) return;
  await recordToolCreditTransaction({
    accountId: input.accountId,
    amount: input.cost,
    type: 'refund',
    product: input.product,
    action: input.action,
    description: input.description ?? 'Lookup failed — refunded',
    referenceType: 'wallet_transaction',
    referenceId: input.spendTransactionId,
    idempotencyKey: `refund:${input.spendTransactionId}`,
  });
}
