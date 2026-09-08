export type CommunityCalendarEvent = {
  id: string;
  title: string;
  body: string | null;
  emoji: string | null;
  starts_at: string;
  ends_at: string | null;
  lat: number | null;
  lng: number | null;
  place_label: string | null;
  account_id: string | null;
};

export async function fetchCommunityCalendarEvents(
  fromISO: string,
  toISO: string,
  signal?: AbortSignal,
): Promise<CommunityCalendarEvent[]> {
  const params = new URLSearchParams({ from: fromISO, to: toISO });
  const res = await fetch(`/api/community/events?${params}`, {
    credentials: 'include',
    signal,
  });
  const json = (await res.json()) as {
    items?: CommunityCalendarEvent[];
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? 'Failed to load events');
  return Array.isArray(json.items) ? json.items : [];
}
