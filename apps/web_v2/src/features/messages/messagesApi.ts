export type DmPeerAccount = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
};

export type DmThreadSummary = {
  id: string;
  updated_at: string;
  other_account: DmPeerAccount | null;
  unread_count: number;
  last_message: {
    body: string;
    created_at: string;
    sender_id: string;
  } | null;
};

export type DmMessage = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

export function dmPeerDisplayName(peer: DmPeerAccount | null | undefined): string {
  if (!peer) return 'Someone';
  const first = peer.first_name?.trim();
  const last = peer.last_name?.trim();
  if (first) return last ? `${first} ${last}` : first;
  if (peer.username?.trim()) return `@${peer.username.trim()}`;
  return 'Someone';
}

/** Compact inbox timestamp — now / 5m / 2h / 3d. */
export function dmInboxTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export async function fetchDmThreads(signal?: AbortSignal): Promise<DmThreadSummary[]> {
  const res = await fetch('/api/messages/threads', {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (!res.ok) throw new Error('Failed to load messages');
  const json = (await res.json()) as { threads?: DmThreadSummary[] };
  return json.threads ?? [];
}

export async function fetchDmThread(
  threadId: string,
  signal?: AbortSignal,
): Promise<{
  messages: DmMessage[];
  other_account: DmPeerAccount | null;
  viewer_account_id: string;
}> {
  const res = await fetch(`/api/messages/threads/${encodeURIComponent(threadId)}`, {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (!res.ok) throw new Error(res.status === 404 ? 'Thread not found' : 'Failed to load');
  return (await res.json()) as {
    messages: DmMessage[];
    other_account: DmPeerAccount | null;
    viewer_account_id: string;
  };
}

export async function sendDmMessage(
  threadId: string,
  body: string,
): Promise<DmMessage> {
  const res = await fetch(`/api/messages/threads/${encodeURIComponent(threadId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error('Failed to send');
  const json = (await res.json()) as { message: DmMessage };
  return json.message;
}

export async function markDmThreadSeen(threadId: string): Promise<void> {
  await fetch(`/api/messages/threads/${encodeURIComponent(threadId)}/seen`, {
    method: 'PATCH',
    credentials: 'include',
  });
}

export async function openOrCreateDmThread(
  otherAccountId: string,
): Promise<{ thread_id: string; created: boolean }> {
  const res = await fetch('/api/messages/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ other_account_id: otherAccountId }),
  });
  if (!res.ok) throw new Error('Failed to open conversation');
  return (await res.json()) as { thread_id: string; created: boolean };
}
