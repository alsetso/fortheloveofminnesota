/** Client helpers for community.account_blocks */

export async function blockAccount(accountId: string): Promise<void> {
  const res = await fetch('/api/community/blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accountId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Could not block user');
  }
}

export async function unblockAccount(accountId: string): Promise<void> {
  const res = await fetch('/api/community/blocks', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accountId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Could not unblock user');
  }
}

export async function fetchBlockedAccountIds(
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await fetch('/api/community/blocks', {
    credentials: 'include',
    signal,
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { blockedAccountIds?: string[] };
  return Array.isArray(json.blockedAccountIds) ? json.blockedAccountIds : [];
}
