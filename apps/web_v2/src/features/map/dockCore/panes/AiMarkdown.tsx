'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Compact Markdown for dock AI bubbles — GFM tables scroll horizontally with clear row breaks. */
export default function AiMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic text-foreground-muted">{children}</em>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-lake-blue underline underline-offset-2"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => <h3 className="mb-1.5 text-sm font-semibold">{children}</h3>,
        h2: ({ children }) => <h3 className="mb-1.5 text-sm font-semibold">{children}</h3>,
        h3: ({ children }) => <h4 className="mb-1 text-sm font-semibold">{children}</h4>,
        code: ({ children }) => (
          <code className="rounded bg-map-ink-subtle px-1 py-0.5 text-[12px]">{children}</code>
        ),
        table: ({ children }) => (
          <div className="-mx-1 mb-3 max-w-full overflow-x-auto overscroll-x-contain rounded-xl ring-1 ring-map-ink-subtle last:mb-0">
            <table className="w-max min-w-full border-collapse text-left text-[12px] leading-snug sm:text-[13px]">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-map-ink-subtle text-foreground">{children}</thead>
        ),
        tbody: ({ children }) => <tbody className="text-foreground">{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-map-ink-subtle last:border-b-0 odd:bg-transparent even:bg-map-ink-faint">
            {children}
          </tr>
        ),
        th: ({ children }) => (
          <th className="whitespace-nowrap px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted sm:px-3">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="max-w-[10rem] whitespace-nowrap px-2.5 py-2 align-top text-foreground sm:max-w-[14rem] sm:px-3 sm:whitespace-normal">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
