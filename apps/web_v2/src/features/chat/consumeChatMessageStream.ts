import type { ChatMessageRow } from '@/features/chat/chatTypes';
import type { AnswerMode } from '@/lib/ai/answerModes';
import type {
  ChatMessageStreamEvent,
  SubjectResponseMilestone,
} from '@/lib/ai/subjectResponseMilestones';

export type ConsumeChatMessageStreamHandlers = {
  onMilestone?: (milestone: SubjectResponseMilestone) => void;
  onUser?: (userMessage: ChatMessageRow) => void;
};

type DoneUsage = Extract<ChatMessageStreamEvent, { type: 'done' }>['usage'];

export type ConsumeChatMessageStreamResult =
  | {
      ok: true;
      userMessage: ChatMessageRow | null;
      assistantMessage: ChatMessageRow;
      usage: DoneUsage | null;
    }
  | { ok: false; error: string; comingSoon?: boolean };

function asChatMessage(
  row: Extract<ChatMessageStreamEvent, { type: 'user' }>['userMessage'],
): ChatMessageRow {
  return {
    id: row.id,
    role: row.role as ChatMessageRow['role'],
    content: row.content,
    created_at: row.created_at,
    meta: row.meta ?? null,
  };
}

/**
 * POST /api/ai/threads/:id/messages and consume SSE milestones → done/error.
 * Early validation failures may still return JSON (non-SSE).
 */
export async function consumeChatMessageStream(
  threadId: string,
  body: { content: string; attachment_ids: string[]; mode?: AnswerMode },
  handlers: ConsumeChatMessageStreamHandlers = {},
): Promise<ConsumeChatMessageStreamResult> {
  const res = await fetch(`/api/ai/threads/${threadId}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('text/event-stream')) {
    const json = (await res.json().catch(() => ({}))) as {
      comingSoon?: boolean;
      error?: string;
    };
    if (json.comingSoon) {
      return { ok: false, error: 'Coming soon', comingSoon: true };
    }
    return {
      ok: false,
      error: json.error || (res.ok ? 'Unexpected response' : 'Send failed'),
    };
  }

  if (!res.body) {
    return { ok: false, error: 'Send failed' };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let userMessage: ChatMessageRow | null = null;
  let assistantMessage: ChatMessageRow | null = null;
  let usage: DoneUsage | null = null;
  let streamError: string | null = null;

  const handleEvent = (event: ChatMessageStreamEvent) => {
    if (event.type === 'milestone') {
      handlers.onMilestone?.({
        id: event.id,
        label: event.label,
        detail: event.detail,
        at: event.at,
      });
      return;
    }
    if (event.type === 'user') {
      userMessage = asChatMessage(event.userMessage);
      handlers.onUser?.(userMessage);
      return;
    }
    if (event.type === 'done') {
      assistantMessage = asChatMessage(event.assistantMessage);
      usage = event.usage;
      return;
    }
    if (event.type === 'error') {
      streamError = event.error;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const dataLine = part
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        handleEvent(JSON.parse(raw) as ChatMessageStreamEvent);
      } catch {
        // ignore malformed chunks
      }
    }
  }

  if (streamError) {
    return { ok: false, error: streamError };
  }
  if (!assistantMessage) {
    return { ok: false, error: 'Send failed' };
  }
  return {
    ok: true,
    userMessage,
    assistantMessage,
    usage,
  };
}
