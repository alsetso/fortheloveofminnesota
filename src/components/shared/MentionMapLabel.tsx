'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';

export interface MentionMapLabelProps {
  emoji: string;
  name: string;
  isSelected?: boolean;
  onClick?: () => void;
  onClear?: () => void;
  className?: string;
  maxWidth?: string;
}

/**
 * Global mention map label component with rounded design.
 * Max height 28px, used for mention type carousels and filters.
 */
export default function MentionMapLabel({
  emoji,
  name,
  isSelected = false,
  onClick,
  onClear,
  className = '',
  maxWidth = 'max-w-[120px]',
}: MentionMapLabelProps) {
  const baseClasses = 'inline-flex items-center gap-1.5 max-h-[28px] px-3 py-1 rounded-full border text-[10px] font-medium whitespace-nowrap flex-shrink-0 transition-colors';
  
  const selectedClasses = isSelected
    ? 'border-border bg-surface-accent text-foreground hover:bg-surface-accent/80'
    : 'border-border-muted bg-surface text-foreground hover:bg-surface-accent';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${selectedClasses} ${className}`}
      aria-pressed={isSelected}
      aria-label={isSelected ? `${name} (selected)${onClear ? ', clear filter' : ''}` : `Filter by ${name}`}
    >
      <span className="text-sm flex-shrink-0">{emoji}</span>
      <span className={`truncate ${maxWidth}`}>{name}</span>
      {isSelected && onClear && (
        <span
          className="flex-shrink-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClear();
          }}
          aria-label="Clear filter"
        >
          <XMarkIcon 
            className="w-3.5 h-3.5 text-foreground-muted hover:text-foreground transition-colors" 
            aria-hidden
          />
        </span>
      )}
    </button>
  );
}
