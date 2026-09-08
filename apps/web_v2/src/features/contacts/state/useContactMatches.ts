'use client';

import { useEffect, useMemo, useState } from 'react';

export type ContactMatch = {
  kind: 'person' | 'address';
  id: string;
  title: string;
  tag: string | null;
};

/**
 * Batch identity_key → existing contact book rows for Save vs Already saved UI.
 */
export function useContactMatches(identityKeys: string[]) {
  const keyList = useMemo(
    () =>
      [...new Set(identityKeys.map((k) => k.trim()).filter(Boolean))].sort(),
    [identityKeys],
  );
  const keySig = keyList.join('\0');

  const [matches, setMatches] = useState<Record<string, ContactMatch>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (keyList.length === 0) {
      setMatches({});
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/contacts/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: ac.signal,
          body: JSON.stringify({ keys: keyList }),
        });
        const json = (await res.json()) as {
          matches?: Record<string, ContactMatch>;
        };
        if (!ac.signal.aborted && res.ok) {
          setMatches(json.matches ?? {});
        }
      } catch {
        if (!ac.signal.aborted) setMatches({});
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
    // keySig captures keyList contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySig]);

  return { matches, loading };
}
