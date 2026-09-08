/** Client + server helpers for the active public.accounts row when one auth user owns many. */

export const SELECTED_ACCOUNT_COOKIE = 'ftlomn_selected_account_id';
export const MULTI_ACCOUNT_HINT_KEY = 'ftlomn_multi_account';

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function readSelectedAccountIdFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${SELECTED_ACCOUNT_COOKIE}=([^;]*)`),
  );
  const fromCookie = match?.[1] ? decodeURIComponent(match[1]) : null;
  if (fromCookie) return fromCookie;
  try {
    return localStorage.getItem(SELECTED_ACCOUNT_COOKIE);
  } catch {
    return null;
  }
}

export function persistSelectedAccountId(accountId: string | null): void {
  if (typeof document === 'undefined') return;
  if (!accountId) {
    document.cookie = `${SELECTED_ACCOUNT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    try {
      localStorage.removeItem(SELECTED_ACCOUNT_COOKIE);
    } catch {
      /* ignore */
    }
    return;
  }
  document.cookie = `${SELECTED_ACCOUNT_COOKIE}=${encodeURIComponent(accountId)}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  try {
    localStorage.setItem(SELECTED_ACCOUNT_COOKIE, accountId);
  } catch {
    /* ignore */
  }
}

export function persistMultiAccountHint(isMulti: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (isMulti) localStorage.setItem(MULTI_ACCOUNT_HINT_KEY, '1');
    else localStorage.removeItem(MULTI_ACCOUNT_HINT_KEY);
  } catch {
    /* ignore */
  }
}

export function readMultiAccountHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(MULTI_ACCOUNT_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearAccountSelectionStorage(): void {
  persistSelectedAccountId(null);
  persistMultiAccountHint(false);
}

/** Fields needed to pick a boot account without importing AuthProvider. */
export type SelectableAccount = {
  id: string;
  username: string | null;
  image_url: string | null;
  onboarded: boolean | null;
  status: string | null;
};

function isUsableAccount(row: SelectableAccount): boolean {
  return row.status !== 'deactivated';
}

function isReadyAccount(row: SelectableAccount): boolean {
  return isUsableAccount(row) && !!row.username && !!row.image_url && row.onboarded === true;
}

/**
 * Pick the account this launch should load.
 *
 * Multi-account users (e.g. bremercole → `cole` + `northstarstate`) must not
 * stall splash / Story on a picker just because the Despia cookie is missing.
 * Stored id wins when it still belongs to this user; otherwise take a ready
 * row. The in-app switcher is the only path that forces a pick.
 */
export function pickBootAccount<T extends SelectableAccount>(
  rows: T[],
  preferredId?: string | null,
): T | null {
  if (rows.length === 0) return null;

  const stored = preferredId ?? readSelectedAccountIdFromDocument();
  if (stored) {
    const match = rows.find((row) => row.id === stored);
    if (match && isUsableAccount(match)) return match;
  }

  const usable = rows.filter(isUsableAccount);
  const pool = usable.length > 0 ? usable : rows;
  return pool.find(isReadyAccount) ?? pool[0] ?? null;
}

export function resolveSelectedAccount<T extends SelectableAccount>(
  rows: T[],
  preferredId?: string | null,
): { account: T | null; needsSelection: boolean } {
  return { account: pickBootAccount(rows, preferredId), needsSelection: false };
}

export function formatAccountPlan(plan: string | null | undefined): string {
  const slug = (plan ?? 'hobby').trim();
  if (!slug) return 'Hobby';
  return slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase();
}
