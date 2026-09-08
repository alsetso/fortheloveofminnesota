export type ChatThreadRow = {
  id: string;
  title: string | null;
  thread_key: string;
  subject_type: string;
  subject_id: string;
  updated_at: string;
  created_at: string;
};

export type ChatMessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  meta?: Record<string, unknown> | null;
};


export type ChatRecentMessage = {
  id: string;
  thread_id: string;
  content: string;
  created_at: string;
};

/** One-line preview for recent-message links under the composer. */
export function previewMessageContent(content: string, max = 72): string {
  const line = content.replace(/\s+/g, ' ').trim();
  if (!line) return 'Attachment';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function formatThreadWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Relative stamp for message toolbars — "Just now", "5m ago", or clock time. */
export function formatMessageWhen(iso: string, nowMs = Date.now()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffSec = Math.max(0, Math.floor((nowMs - d.getTime()) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  const now = new Date(nowMs);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function subjectTypeLabel(subjectType: string): string {
  if (subjectType === 'general') return 'Helpdesk';
  if (subjectType === 'territory_unit') return 'Place';
  return subjectType.replace(/_/g, ' ');
}
