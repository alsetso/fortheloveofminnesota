'use client';

import { useCallback, useEffect, useState } from 'react';

/** Distinct tags already used on this account's contact book. */
export function useContactTags(enabled = true) {
  const [tags, setTags] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setTags([]);
      setCounts({});
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/contacts/tags', {
          credentials: 'include',
          signal: ac.signal,
        });
        const json = (await res.json()) as {
          tags?: string[];
          counts?: Record<string, number>;
        };
        if (!ac.signal.aborted && res.ok) {
          setTags(json.tags ?? []);
          setCounts(json.counts ?? {});
        }
      } catch {
        if (!ac.signal.aborted) {
          setTags([]);
          setCounts({});
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [enabled, nonce]);

  return { tags, counts, loading, refresh };
}
