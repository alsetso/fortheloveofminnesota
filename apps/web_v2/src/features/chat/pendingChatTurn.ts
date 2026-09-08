import type { PendingChatAttachment } from '@/features/chat/uploadChatAttachment';
import {
  DEFAULT_ANSWER_MODE,
  parseAnswerMode,
  type AnswerMode,
} from '@/lib/ai/answerModes';

export type PendingChatTurn = {
  content: string;
  attachmentIds: string[];
  attachments: PendingChatAttachment[];
  mode: AnswerMode;
};

const keyFor = (threadId: string) => `ftlom:chat:pending:${threadId}`;

/** Survives Strict Mode remounts until the thread page starts the stream. */
const memoryPending = new Map<string, PendingChatTurn>();
const kickoffInFlight = new Set<string>();

/** Stash the first turn so /helpdesk can navigate before the stream starts. */
export function stashPendingChatTurn(threadId: string, turn: PendingChatTurn) {
  memoryPending.set(threadId, turn);
  try {
    sessionStorage.setItem(keyFor(threadId), JSON.stringify(turn));
  } catch {
    // Private mode / quota — memory map still works for same-tab navigate.
  }
}

function parseTurn(raw: string): PendingChatTurn | null {
  try {
    const parsed = JSON.parse(raw) as PendingChatTurn;
    if (!parsed || typeof parsed.content !== 'string') return null;
    if (!Array.isArray(parsed.attachmentIds)) return null;
    return {
      content: parsed.content,
      attachmentIds: parsed.attachmentIds,
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      mode: parseAnswerMode(parsed.mode ?? DEFAULT_ANSWER_MODE),
    };
  } catch {
    return null;
  }
}

/** Read without clearing (safe across Strict Mode remount). */
export function peekPendingChatTurn(threadId: string): PendingChatTurn | null {
  const mem = memoryPending.get(threadId);
  if (mem) return mem;
  try {
    const raw = sessionStorage.getItem(keyFor(threadId));
    if (!raw) return null;
    const turn = parseTurn(raw);
    if (turn) memoryPending.set(threadId, turn);
    return turn;
  } catch {
    return null;
  }
}

export function clearPendingChatTurn(threadId: string) {
  memoryPending.delete(threadId);
  try {
    sessionStorage.removeItem(keyFor(threadId));
  } catch {
    // ignore
  }
}

/**
 * Claim first-turn kickoff once per thread (blocks double-send on remount).
 * Returns the turn if this caller should start the stream.
 */
export function claimPendingChatKickoff(threadId: string): PendingChatTurn | null {
  if (kickoffInFlight.has(threadId)) return null;
  const turn = peekPendingChatTurn(threadId);
  if (!turn) return null;
  kickoffInFlight.add(threadId);
  clearPendingChatTurn(threadId);
  return turn;
}

export function releasePendingChatKickoff(threadId: string) {
  kickoffInFlight.delete(threadId);
}
