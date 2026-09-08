'use client';

import { useEffect, useRef, useState } from 'react';
import {
  TEXT_OVERLAY_COLORS,
  type TextLayerBackground,
  type TextLayerData,
} from '@/components/media/capture/TextOverlay/types';
import { haptic } from '@/lib/despia/haptics';
import { safePadBottomKeyboard, safePadTop } from '@/lib/despia/safeArea';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

const BG_CYCLE: TextLayerBackground[] = ['none', 'solid', 'glass'];

export type TextInputModalProps = {
  open: boolean;
  /** Existing layer when re-editing; null when creating. */
  initial: TextLayerData | null;
  onCancel: () => void;
  onCommit: (layer: TextLayerData) => void;
};

/**
 * Instagram-style floating text editor over capture preview.
 * Color / B / Bg tools stick to the top of the native keyboard via
 * Despia `--keyboard-inset` (home indicator when keyboard is closed).
 */
export default function TextInputModal({
  open,
  initial,
  onCancel,
  onCommit,
}: TextInputModalProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<TextLayerData | null>(null);

  useEffect(() => {
    if (!open || !initial) {
      setDraft(null);
      return;
    }
    setDraft({ ...initial });
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      const el = inputRef.current;
      if (el) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }, 40);
    return () => window.clearTimeout(t);
  }, [open, initial]);

  if (!open || !draft) return null;

  const isLight = draft.color === '#FFFFFF' || draft.color === '#FFCC00';
  const previewColor =
    draft.background === 'solid'
      ? isLight
        ? '#111111'
        : '#FFFFFF'
      : draft.color;
  const previewBg =
    draft.background === 'solid'
      ? draft.color
      : draft.background === 'glass'
        ? 'rgba(0,0,0,0.42)'
        : 'transparent';

  const commit = () => {
    const content = draft.content.trim();
    if (!content) {
      onCancel();
      return;
    }
    haptic.toggle();
    onCommit({ ...draft, content });
  };

  const cycleBackground = () => {
    haptic.toggle();
    const idx = BG_CYCLE.indexOf(draft.background);
    const next = BG_CYCLE[(idx + 1) % BG_CYCLE.length]!;
    setDraft({ ...draft, background: next });
  };

  return (
    <div
      className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} flex flex-col bg-black/55`}
      role="dialog"
      aria-modal="true"
      aria-label="Add text"
      style={{ paddingTop: safePadTop('0.5rem') }}
      onClick={commit}
    >
      <div
        className="flex shrink-0 items-center justify-between px-4 pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            haptic.toggle();
            onCancel();
          }}
          className="inline-flex h-10 items-center px-1 text-[15px] font-semibold text-white/80"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          className="inline-flex h-10 items-center px-1 text-[15px] font-semibold text-white"
        >
          Done
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-6">
        <div
          className="max-w-[90%] rounded-xl px-3 py-2 text-center"
          style={{
            backgroundColor: previewBg,
            backdropFilter: draft.background === 'glass' ? 'blur(10px)' : undefined,
            WebkitBackdropFilter: draft.background === 'glass' ? 'blur(10px)' : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            ref={inputRef}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            rows={3}
            placeholder="Type something…"
            className="w-full min-w-[12rem] resize-none bg-transparent text-center text-[28px] leading-tight outline-none placeholder:text-white/35"
            style={{
              color: previewColor,
              fontWeight: draft.bold ? 700 : 500,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        </div>
      </div>

      {/*
        Sticky to keyboard top: DespiaNativeChrome sets --keyboard-inset while
        the WebView stays full-screen. Closed keyboard → home-indicator inset.
      */}
      <div
        className="shrink-0 border-t border-white/10 bg-black/80 px-4 pt-3 backdrop-blur-md"
        style={{ paddingBottom: safePadBottomKeyboard('0.65rem') }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5">
            {TEXT_OVERLAY_COLORS.map((color) => {
              const active = draft.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`Text color ${color}`}
                  aria-pressed={active}
                  onClick={() => {
                    haptic.toggle();
                    setDraft({ ...draft, color });
                    inputRef.current?.focus();
                  }}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    active ? 'scale-110 border-white' : 'border-white/25'
                  }`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={draft.bold}
              onClick={() => {
                haptic.toggle();
                setDraft({ ...draft, bold: !draft.bold });
                inputRef.current?.focus();
              }}
              className={`inline-flex h-10 min-w-[3.25rem] items-center justify-center rounded-full px-3 text-[15px] font-bold transition ${
                draft.bold ? 'bg-white text-black' : 'bg-white/15 text-white'
              }`}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => {
                cycleBackground();
                inputRef.current?.focus();
              }}
              className="inline-flex h-10 items-center justify-center rounded-full bg-white/15 px-4 text-[13px] font-semibold text-white"
            >
              {draft.background === 'none'
                ? 'Bg: None'
                : draft.background === 'solid'
                  ? 'Bg: Solid'
                  : 'Bg: Glass'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
