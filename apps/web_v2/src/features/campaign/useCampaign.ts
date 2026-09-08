'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampaignChapterWithProgress, CampaignPayload } from './campaignTypes';

type CampaignState = {
  chapters: CampaignChapterWithProgress[];
  loading: boolean;
  error: string | null;
};

const CACHE_KEY = 'ftlomn:campaign';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — admin publishes → user sees within one refresh

function loadCache(): CampaignChapterWithProgress[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; chapters: CampaignChapterWithProgress[] };
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.chapters;
  } catch {
    return null;
  }
}

function saveCache(chapters: CampaignChapterWithProgress[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), chapters }));
  } catch {
    // storage full / private mode
  }
}

export function clearCampaignCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}

export function useCampaign() {
  const [state, setState] = useState<CampaignState>({
    chapters: [],
    loading: true,
    error: null,
  });
  const fetchedRef = useRef(false);

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = loadCache();
      if (cached) {
        setState({ chapters: cached, loading: false, error: null });
        return;
      }
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch('/api/campaign/chapters', { cache: 'no-store' });
      const json = await res.json() as { chapters?: CampaignChapterWithProgress[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load campaign');
      const chapters = json.chapters ?? [];
      saveCache(chapters);
      setState({ chapters, loading: false, error: null });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load campaign',
      }));
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void load();
  }, [load]);

  const markRead = useCallback(async (chapterId: number, sentenceIds: number[]) => {
    if (sentenceIds.length === 0) return;
    // Optimistic — update local state immediately then persist
    setState((prev) => {
      const chapters = prev.chapters.map((ch) => {
        if (ch.id !== chapterId) return ch;
        const newReadIds = new Set(sentenceIds);
        const readable = ch.sentences.filter((s) => s.style !== 'spacer');
        const allRead = readable.every((s) => newReadIds.has(s.id) || ch.nextSentenceIndex > ch.sentences.indexOf(s));
        return {
          ...ch,
          // bump nextSentenceIndex beyond the last newly read
          nextSentenceIndex: Math.max(
            ch.nextSentenceIndex,
            (() => {
              let last = ch.nextSentenceIndex;
              for (const sid of sentenceIds) {
                const idx = ch.sentences.findIndex((s) => s.id === sid);
                if (idx >= 0) last = Math.max(last, idx + 1);
              }
              return last;
            })(),
          ),
          complete: allRead,
        };
      });
      saveCache(chapters);
      return { ...prev, chapters };
    });

    try {
      await fetch('/api/campaign/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentenceIds, chapterId }),
      });
    } catch {
      // Non-fatal — progress is best-effort, re-fetching will reconcile
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  return { ...state, markRead, refresh };
}
