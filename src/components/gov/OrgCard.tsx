import Link from 'next/link';
import GovBadge from './GovBadge';

interface OrgCardCommissioner {
  name: string;
  slug: string | null;
}

interface OrgCardProps {
  name: string;
  slug: string;
  href: string;
  description?: string | null;
  govType?: string | null;
  branch?: string | null;
  /** Current FY budget amount in dollars */
  budgetAmount?: number | null;
  budgetYear?: number | null;
  /** Top commissioner/director for this org */
  commissioner?: OrgCardCommissioner | null;
  website?: string | null;
  className?: string;
}

function formatBudgetCompact(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export default function OrgCard({
  name,
  href,
  description,
  govType,
  branch,
  budgetAmount,
  budgetYear,
  commissioner,
  className = '',
}: OrgCardProps) {
  return (
    <Link
      href={href}
      className={`block border border-border rounded-md p-3 hover:border-border hover:bg-surface-muted transition-colors group ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-foreground leading-snug group-hover:text-accent transition-colors">
          {name}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {branch && <GovBadge label={branch} />}
          {govType && <GovBadge label={govType} />}
        </div>
      </div>

      {description && (
        <p className="text-[10px] text-foreground-muted mt-1 line-clamp-2 leading-relaxed">
          {description}
        </p>
      )}

      {/* Budget chip */}
      {budgetAmount != null && budgetAmount > 0 && (
        <div className="mt-1.5 flex items-center gap-1">
          <span className="text-[9px] font-medium text-foreground-muted uppercase tracking-wide">
            {budgetYear ? `FY${budgetYear}` : 'Budget'}
          </span>
          <span className="text-[10px] font-semibold text-foreground">
            {formatBudgetCompact(budgetAmount)}
          </span>
        </div>
      )}

      {/* Commissioner chip */}
      {commissioner && (
        <div className="mt-1.5 text-[10px] text-foreground-muted">
          {commissioner.name}
        </div>
      )}
    </Link>
  );
}
