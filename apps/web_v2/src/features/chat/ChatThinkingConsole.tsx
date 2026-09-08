'use client';

import type { SubjectResponseMilestone } from '@/lib/ai/subjectResponseMilestones';

type ChatThinkingConsoleProps = {
  milestones: SubjectResponseMilestone[];
  active?: boolean;
};

/**
 * Compact monospace milestone “command line” under the optimistic user turn.
 */
export default function ChatThinkingConsole({
  milestones,
  active = true,
}: ChatThinkingConsoleProps) {
  if (milestones.length === 0 && !active) return null;

  return (
    <div
      className="mt-1 w-full max-w-[min(100%,28rem)] overflow-hidden font-mono text-[12px] leading-relaxed"
      aria-live="polite"
      aria-label="Thinking progress"
    >
      <ul className="space-y-0.5 text-foreground-muted">
        {milestones.length === 0 && active ? (
          <li className="flex gap-2 opacity-70">
            <span className="shrink-0 text-foreground/40">›</span>
            <span className="animate-pulse">Planning…</span>
          </li>
        ) : null}
        {milestones.map((m, i) => {
          const isLast = i === milestones.length - 1;
          const live = active && isLast;
          return (
            <li
              key={m.id}
              className={`flex gap-2 ${live ? 'text-foreground' : 'opacity-55'}`}
            >
              <span className="shrink-0 text-foreground/40">›</span>
              <span className={live ? 'animate-pulse' : undefined}>
                <span className="font-medium">{m.label}</span>
                {m.detail ? (
                  <span className="mt-0.5 block whitespace-pre-wrap break-words opacity-80">
                    {m.detail}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
