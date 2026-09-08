import type { AnswerMode } from '@/lib/ai/answerModes';

export type AiUsageRollup = {
  turn_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cache_write_tokens: number;
  web_search_call_count: number;
  web_search_turns: number;
  duration_ms: number;
  first_at: string | null;
  last_at: string | null;
};

export type AiUsageTurnRow = {
  id: string;
  created_at: string;
  model: string | null;
  mode: AnswerMode | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cache_write_tokens: number;
  web_search_used: boolean;
  web_search_call_count: number;
  duration_ms: number;
};

export type AiUsageModeRollup = AiUsageRollup & {
  mode: AnswerMode;
};

export type ThreadUsageResponse = {
  thread: AiUsageRollup;
  account: AiUsageRollup & { thread_count: number };
  by_mode: AiUsageModeRollup[];
  recent: AiUsageTurnRow[];
};

/** Account-wide chat usage — all threads for the signed-in account. */
export type AccountUsageResponse = {
  account: AiUsageRollup & {
    thread_count: number;
    message_count: number;
  };
  by_mode: AiUsageModeRollup[];
  recent: AiUsageTurnRow[];
};

export function emptyAiUsageRollup(): AiUsageRollup {
  return {
    turn_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    reasoning_tokens: 0,
    cached_tokens: 0,
    cache_write_tokens: 0,
    web_search_call_count: 0,
    web_search_turns: 0,
    duration_ms: 0,
    first_at: null,
    last_at: null,
  };
}

/** Compact token count — 1.2k, 12.4k, 1.1M */
export function formatTokenCount(n: number): string {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v < 1000) return String(v);
  if (v < 10_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (v < 1_000_000) return `${Math.round(v / 1000)}k`;
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function formatDurationMs(ms: number): string {
  const v = Math.max(0, Math.round(Number(ms) || 0));
  if (v < 1000) return `${v}ms`;
  if (v < 60_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}s`;
  const mins = Math.floor(v / 60_000);
  const secs = Math.round((v % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

/** Compact integer — 1.2k, 12k, 1.1M */
export function formatCount(n: number): string {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v < 1000) return String(v);
  if (v < 10_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (v < 1_000_000) return `${Math.round(v / 1000)}k`;
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
