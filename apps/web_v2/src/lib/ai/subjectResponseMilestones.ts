/** Live thinking milestones streamed during a subject Responses turn. */

export type SubjectResponseMilestone = {
  id: string;
  label: string;
  detail?: string;
  at: number;
};

export type ChatMessageStreamEvent =
  | {
      type: 'milestone';
      id: string;
      label: string;
      detail?: string;
      at: number;
    }
  | {
      type: 'user';
      userMessage: {
        id: string;
        role: string;
        content: string;
        created_at: string;
        meta?: Record<string, unknown> | null;
      };
    }
  | {
      type: 'done';
      assistantMessage: {
        id: string;
        role: string;
        content: string;
        created_at: string;
        meta?: Record<string, unknown> | null;
      };
      usage: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    reasoning_tokens: number;
    cached_tokens?: number;
    cache_write_tokens?: number;
    web_search_used: boolean;
        resolver: string;
      };
    }
  | { type: 'error'; error: string };
