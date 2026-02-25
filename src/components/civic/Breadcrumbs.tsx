'use client';

import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href: string | null;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="mb-3" aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-xs text-foreground-muted flex-wrap">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-1.5">
            {idx > 0 && (
              <span
                aria-hidden="true"
                className="text-foreground-muted select-none flex items-center"
                style={{ lineHeight: '1' }}
              >
                /
              </span>
            )}
            {item.href ? (
              <Link
                href={item.href}
                className="text-foreground-muted hover:text-foreground transition-colors underline-offset-2 hover:underline flex items-center"
                style={{ lineHeight: '1.2' }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className="text-foreground font-medium flex items-center"
                style={{ lineHeight: '1.2' }}
                aria-current={idx === items.length - 1 ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

