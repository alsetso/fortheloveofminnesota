/**
 * Client-side community feed topic filters — hide contribution categories
 * (Report, Highlight, Event, Story, Idea) from All / Places / Following.
 */

import {
  CONTRIBUTION_CATEGORIES,
  type ContributionCategoryId,
} from '@/features/community/contributionTypes';

export type FeedFilterTopicId = ContributionCategoryId;

export const FEED_FILTER_TOPICS = CONTRIBUTION_CATEGORIES.map((c) => ({
  id: c.id as FeedFilterTopicId,
  label: c.label,
  emoji: c.emoji,
  description: c.description,
}));

const STORAGE_KEY = 'ftlomn_feed_hidden_topics';

type Listener = () => void;

let hidden = new Set<FeedFilterTopicId>();
let hydrated = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function readStorage(): Set<FeedFilterTopicId> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const allowed = new Set(FEED_FILTER_TOPICS.map((t) => t.id));
    return new Set(
      parsed.filter(
        (id): id is FeedFilterTopicId =>
          typeof id === 'string' && allowed.has(id as FeedFilterTopicId),
      ),
    );
  } catch {
    return new Set();
  }
}

function writeStorage(next: Set<FeedFilterTopicId>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    /* ignore */
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === 'undefined') return;
  hidden = readStorage();
  hydrated = true;
}

export function subscribeFeedFilters(listener: Listener): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFeedHiddenTopicsSnapshot(): ReadonlySet<FeedFilterTopicId> {
  ensureHydrated();
  return hidden;
}

export function isFeedTopicHidden(id: FeedFilterTopicId): boolean {
  ensureHydrated();
  return hidden.has(id);
}

export function setFeedTopicHidden(id: FeedFilterTopicId, hide: boolean) {
  ensureHydrated();
  const next = new Set(hidden);
  if (hide) next.add(id);
  else next.delete(id);
  hidden = next;
  writeStorage(next);
  emit();
}

export function resetFeedFilters() {
  ensureHydrated();
  hidden = new Set();
  writeStorage(hidden);
  emit();
}

export function feedHiddenTopicCount(): number {
  ensureHydrated();
  return hidden.size;
}
