'use client';

import { useEffect, useId, useRef } from 'react';
import {
  ANSWER_MODE_COPY,
  ANSWER_MODES,
  type AnswerMode,
} from '@/lib/ai/answerModes';
import { IconX } from '@/features/map/dockCore/core/icons';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

type ChatAnswerModeSheetProps = {
  open: boolean;
  value: AnswerMode;
  onChange: (mode: AnswerMode) => void;
  onClose: () => void;
};

/**
 * How-should-this-answer sheet — Fast / Standard / Deep with plain-language copy.
 */
export default function ChatAnswerModeSheet({
  open,
  value,
  onChange,
  onClose,
}: ChatAnswerModeSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${Z_LAYER_CLASS.APP_OVERLAY} flex items-end justify-center sm:items-center`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="Close answer mode"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[24px] bg-[#f7f5f1] shadow-2xl ring-1 ring-black/[0.08] sm:rounded-[24px]"
      >
        <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-3">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-[16px] font-semibold text-foreground"
          >
            How should this answer?
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full transition active:bg-black/[0.06]"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <ul className="px-2 py-2" role="listbox" aria-label="Answer mode">
          {ANSWER_MODES.map((mode) => {
            const copy = ANSWER_MODE_COPY[mode];
            const selected = mode === value;
            return (
              <li key={mode}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(mode);
                    onClose();
                  }}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                    selected
                      ? 'bg-black/[0.06]'
                      : 'active:bg-black/[0.04]'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ring-1 ${
                      selected
                        ? 'bg-[#2a6f8f] ring-[#2a6f8f]'
                        : 'ring-black/[0.2]'
                    }`}
                    aria-hidden
                  >
                    {selected ? (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[16px] font-semibold text-foreground">
                        {copy.label}
                      </span>
                      <span className="text-[12px] text-foreground-muted">
                        {copy.hint}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[14px] text-foreground-muted">
                      {copy.blurb}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
