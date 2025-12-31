import Link from 'next/link';

export interface BreadcrumbItem {
  name: string;
  href: string;
  isCurrentPage?: boolean;
}

interface ExploreBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function ExploreBreadcrumbs({ items }: ExploreBreadcrumbsProps) {
  return (
    <nav className="mb-3" aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-xs text-gray-600">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.isCurrentPage ? (
              <span className="text-gray-900 font-medium" aria-current="page">
                {item.name}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-gray-900 transition-colors">
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

