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
      <ol className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            {idx > 0 && <span aria-hidden="true" className="text-gray-400">/</span>}
            {item.href ? (
              <Link 
                href={item.href} 
                className="hover:text-gray-900 transition-colors underline-offset-2 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-900 font-medium" aria-current={idx === items.length - 1 ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

