import {
  emptyAiUsageRollup,
  type AiUsageModeRollup,
  type AiUsageRollup,
  type AiUsageTurnRow,
} from '@/features/chat/chatUsage';
import { isAnswerMode, type AnswerMode } from '@/lib/ai/answerModes';

export type AiUsageEventRow = {
  id: string;
  created_at: string;
  model: string | null;
  mode?: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  reasoning_tokens: number | null;
  cached_tokens: number | null;
  cache_write_tokens: number | null;
  web_search_used: boolean | null;
  web_search_call_count: number | null;
  duration_ms: number | null;
  subject_thread_id?: string | null;
  meta?: Record<string, unknown> | null;
};

export const AI_USAGE_EVENT_COLS =
  'id, created_at, model, mode, input_tokens, output_tokens, total_tokens, reasoning_tokens, cached_tokens, cache_write_tokens, web_search_used, web_search_call_count, duration_ms, subject_thread_id, meta';

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function modeOf(r: AiUsageEventRow): AnswerMode | null {
  if (isAnswerMode(r.mode)) return r.mode;
  const metaMode = r.meta && typeof r.meta === 'object' ? r.meta.answer_mode : null;
  return isAnswerMode(metaMode) ? metaMode : null;
}

export function rollupFromEvents(
  rows: AiUsageEventRow[],
): AiUsageRollup & { thread_count: number } {
  if (rows.length === 0) {
    return { ...emptyAiUsageRollup(), thread_count: 0 };
  }

  let input_tokens = 0;
  let output_tokens = 0;
  let total_tokens = 0;
  let reasoning_tokens = 0;
  let cached_tokens = 0;
  let cache_write_tokens = 0;
  let web_search_call_count = 0;
  let web_search_turns = 0;
  let duration_ms = 0;
  let first_at: string | null = null;
  let last_at: string | null = null;
  const threads = new Set<string>();

  for (const r of rows) {
    input_tokens += num(r.input_tokens);
    output_tokens += num(r.output_tokens);
    total_tokens += num(r.total_tokens);
    reasoning_tokens += num(r.reasoning_tokens);
    cached_tokens += num(r.cached_tokens);
    cache_write_tokens += num(r.cache_write_tokens);
    web_search_call_count += num(r.web_search_call_count);
    if (r.web_search_used) web_search_turns += 1;
    duration_ms += num(r.duration_ms);
    const created = r.created_at;
    if (created) {
      if (!first_at || created < first_at) first_at = created;
      if (!last_at || created > last_at) last_at = created;
    }
    if (r.subject_thread_id) threads.add(r.subject_thread_id);
  }

  return {
    turn_count: rows.length,
    input_tokens,
    output_tokens,
    total_tokens,
    reasoning_tokens,
    cached_tokens,
    cache_write_tokens,
    web_search_call_count,
    web_search_turns,
    duration_ms,
    first_at,
    last_at,
    thread_count: threads.size,
  };
}

/** Per-mode rollups — only modes that appear in the event set. */
export function rollupByMode(rows: AiUsageEventRow[]): AiUsageModeRollup[] {
  const buckets = new Map<AnswerMode, AiUsageEventRow[]>();
  for (const r of rows) {
    const mode = modeOf(r);
    if (!mode) continue;
    const list = buckets.get(mode) ?? [];
    list.push(r);
    buckets.set(mode, list);
  }
  const order: AnswerMode[] = ['fast', 'standard', 'deep'];
  return order
    .filter((m) => buckets.has(m))
    .map((mode) => {
      const rollup = rollupFromEvents(buckets.get(mode) ?? []);
      return { mode, ...rollup };
    });
}

export function toUsageTurnRow(r: AiUsageEventRow): AiUsageTurnRow {
  return {
    id: String(r.id),
    created_at: String(r.created_at),
    model: r.model ?? null,
    mode: modeOf(r),
    input_tokens: num(r.input_tokens),
    output_tokens: num(r.output_tokens),
    total_tokens: num(r.total_tokens),
    reasoning_tokens: num(r.reasoning_tokens),
    cached_tokens: num(r.cached_tokens),
    cache_write_tokens: num(r.cache_write_tokens),
    web_search_used: Boolean(r.web_search_used),
    web_search_call_count: num(r.web_search_call_count),
    duration_ms: num(r.duration_ms),
  };
}
