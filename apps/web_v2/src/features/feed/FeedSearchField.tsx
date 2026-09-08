'use client';

import { useRef, useState } from 'react';
import { IconSearch, IconX } from '@/features/map/dockCore/core/icons';

/**
 * Apple UISearchBar-shaped field for Own large-title pages.
 * Soft fill, 16px type (no iOS zoom), Cancel on focus.
 */
export function FeedSearchField({
  value,
  onChange,
  onFocusChange,
  onCancel,
  onSubmit,
  placeholder = 'Search',
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onCancel?: () => void;
  /** Fired on keyboard Search / Enter — completes a typed query. */
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const showCancel = focused || value.length > 0;

  const setFocusedState = (next: boolean) => {
    setFocused(next);
    onFocusChange?.(next);
  };

  return (
    <div className="flex items-center gap-2.5">
      <label className="relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-[10px] border border-white/45 bg-white/40 px-2.5 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.5)] backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color] focus-within:border-white/60 focus-within:bg-white/55">
        <IconSearch className="h-[17px] w-[17px] shrink-0 text-foreground-muted" />
        <span className="sr-only">{placeholder}</span>
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocusedState(true)}
          onBlur={() => setFocusedState(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            onSubmit?.();
          }}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] leading-tight text-foreground outline-none placeholder:text-foreground-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground-muted/35 text-white transition active:scale-90"
          >
            <IconX className="h-3 w-3" />
          </button>
        ) : null}
      </label>
      {showCancel ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('');
            inputRef.current?.blur();
            setFocusedState(false);
            onCancel?.();
          }}
          className="shrink-0 text-[17px] font-normal text-lake-blue transition active:opacity-60"
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
