import type { AccountRow } from './AuthProvider';

/** Display name from public.accounts (first/last → username → email). */
export function getAccountDisplayName(
  account: AccountRow | null | undefined,
  emailFallback?: string | null,
): string {
  if (account?.first_name || account?.last_name) {
    return `${account.first_name ?? ''} ${account.last_name ?? ''}`.trim();
  }
  if (account?.username?.trim()) return account.username.trim();
  const email = emailFallback?.trim() || account?.email?.trim();
  if (email) return email;
  return 'Account';
}

export function getAccountHandle(account: AccountRow | null | undefined): string | null {
  const u = account?.username?.trim();
  return u ? `@${u}` : null;
}

export function getAccountInitials(
  account: AccountRow | null | undefined,
  emailOrUser?: string | null | { email?: string | null },
): string {
  const first = account?.first_name?.trim()?.[0];
  const last = account?.last_name?.trim()?.[0];
  if (first || last) return `${first ?? ''}${last ?? ''}`.toUpperCase();
  const email =
    typeof emailOrUser === 'string'
      ? emailOrUser
      : emailOrUser?.email ?? account?.email ?? null;
  const userInitial = account?.username?.trim()?.[0] ?? email?.trim()?.[0];
  return (userInitial ?? '?').toUpperCase();
}
