interface GovBadgeProps {
  label: string;
  variant?: 'blue' | 'green' | 'gray' | 'red' | 'amber';
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<GovBadgeProps['variant']>, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800',
  gray: 'bg-surface-muted text-foreground-muted border-border',
  red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
};

/** Map common label values to a sensible default variant */
function inferVariant(label: string): NonNullable<GovBadgeProps['variant']> {
  const l = label.toLowerCase();
  if (l === 'executive') return 'green';
  if (l === 'legislative') return 'blue';
  if (l === 'judicial') return 'amber';
  if (l === 'department' || l === 'agency') return 'green';
  if (l === 'board' || l === 'commission' || l === 'council') return 'gray';
  if (l === 'court') return 'amber';
  return 'gray';
}

export default function GovBadge({ label, variant, className = '' }: GovBadgeProps) {
  const resolvedVariant = variant ?? inferVariant(label);
  return (
    <span
      className={`inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded border ${VARIANT_CLASSES[resolvedVariant]} ${className}`}
    >
      {label}
    </span>
  );
}
