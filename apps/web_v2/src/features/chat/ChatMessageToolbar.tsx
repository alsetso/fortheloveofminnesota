'use client';

import { useCallback, useState } from 'react';
import { formatMessageWhen } from '@/features/chat/chatTypes';
import {
  IconCheckSmall,
  IconChevronDown,
  IconCopy,
  IconSparkles,
} from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';

export type ChatToolbarCitation = {
  url: string;
  title: string | null;
};

type ChatMessageToolbarProps = {
  content: string;
  createdAt: string;
  /** Align under a right-sent pill vs left reply. */
  align?: 'start' | 'end';
  /** Concise reasoning summary (assistant only). */
  reasoningSummary?: string | null;
  /** Web citations from Responses (assistant only). */
  citations?: ChatToolbarCitation[];
};

type Panel = 'reasoning' | 'sources' | null;

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Compact message chrome — copy, timestamp, and optional Reasoning / Sources.
 */
export default function ChatMessageToolbar({
  content,
  createdAt,
  align = 'start',
  reasoningSummary = null,
  citations = [],
}: ChatMessageToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  const hasReasoning = Boolean(reasoningSummary?.trim());
  const hasSources = citations.length > 0;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      haptic.play('light');
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard may be blocked */
    }
  }, [content]);

  const toggle = (next: Panel) => {
    setPanel((cur) => (cur === next ? null : next));
    haptic.play('light');
  };

  return (
    <div
      className={`mt-1.5 ${align === 'end' ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}
    >
      <div
        className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-foreground-muted/55 ${
          align === 'end' ? 'justify-end' : 'justify-start'
        }`}
      >
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? 'Copied' : 'Copy message'}
          className="grid h-7 w-7 place-items-center rounded-md transition active:bg-black/[0.05] active:opacity-70"
        >
          {copied ? (
            <IconCheckSmall className="h-3.5 w-3.5" />
          ) : (
            <IconCopy className="h-3.5 w-3.5" />
          )}
        </button>

        {hasReasoning ? (
          <button
            type="button"
            onClick={() => toggle('reasoning')}
            aria-expanded={panel === 'reasoning'}
            className={`inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium transition active:bg-black/[0.05] ${
              panel === 'reasoning' ? 'text-foreground' : ''
            }`}
          >
            <IconSparkles className="h-3.5 w-3.5" />
            Reasoning
            <IconChevronDown
              className={`h-3 w-3 transition ${panel === 'reasoning' ? 'rotate-180' : ''}`}
            />
          </button>
        ) : null}

        {hasSources ? (
          <button
            type="button"
            onClick={() => toggle('sources')}
            aria-expanded={panel === 'sources'}
            className={`inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium transition active:bg-black/[0.05] ${
              panel === 'sources' ? 'text-foreground' : ''
            }`}
          >
            Sources
            <span className="tabular-nums opacity-70">{citations.length}</span>
            <IconChevronDown
              className={`h-3 w-3 transition ${panel === 'sources' ? 'rotate-180' : ''}`}
            />
          </button>
        ) : null}

        <time
          dateTime={createdAt}
          className="text-[12px] font-normal tabular-nums tracking-tight"
        >
          {formatMessageWhen(createdAt)}
        </time>
      </div>

      {panel === 'reasoning' && hasReasoning ? (
        <div className="mt-2 w-full max-w-xl rounded-xl bg-black/[0.03] px-3 py-2.5 text-[13px] leading-relaxed text-foreground-muted">
          <p className="whitespace-pre-wrap">{reasoningSummary}</p>
        </div>
      ) : null}

      {panel === 'sources' && hasSources ? (
        <ul className="mt-2 w-full max-w-xl space-y-1.5 rounded-xl bg-black/[0.03] px-3 py-2.5">
          {citations.map((c) => (
            <li key={c.url}>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-[13px] font-medium text-foreground underline-offset-2 transition hover:underline"
              >
                {c.title?.trim() || hostLabel(c.url)}
              </a>
              <p className="truncate text-[11px] text-foreground-muted">
                {hostLabel(c.url)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
