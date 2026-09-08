'use client';

/**
 * CampaignReader — full-screen book-style story reader.
 *
 * Views:
 *   index        → table of contents — all chapters, status, lock hints
 *   chapter-start → title card for the selected chapter
 *   reading      → left/right tap + swipe sentence stepper
 *
 * Flow: open → index → chapter-start → reading → (finish) → index
 * From index the user can jump to any unlocked chapter.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CampaignChapterWithProgress } from './campaignTypes';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';
import { safePadTop, safePadBottom } from '@/lib/despia/safeArea';

// Sheet animation phases — mirrors iOS sheet presentation
type SheetPhase = 'entering' | 'open' | 'dragging' | 'closing';

// How far (px) or how fast (px/ms upward) before the sheet dismisses
const DISMISS_DISTANCE = -90;
const DISMISS_VELOCITY = -0.55;

function ReaderCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      aria-label="Close story"
      className="relative z-10 h-8 w-8 shrink-0 flex items-center justify-center rounded-full text-black/40 hover:text-black/70 active:bg-black/10 transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

type ReaderView = 'index' | 'chapter-start' | 'reading';

type Props = {
  chapters: CampaignChapterWithProgress[];
  initialChapter: CampaignChapterWithProgress;
  onClose: () => void;
  onSentenceRead: (chapterId: number, sentenceId: number) => void;
};

// ─── Index view ────────────────────────────────────────────────────────────

function ChapterIndexView({
  chapters,
  activeChapterId,
  onSelect,
  onClose,
  scrollRef,
}: {
  chapters: CampaignChapterWithProgress[];
  activeChapterId: number;
  onSelect: (chapter: CampaignChapterWithProgress) => void;
  onClose: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col h-full w-full animate-in fade-in duration-150">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pb-3 shrink-0"
        style={{ paddingTop: safePadTop('0.75rem') }}
      >
        <h1 className="text-[24px] font-bold text-[#0a0a0b] leading-tight tracking-tight">The Story</h1>
        <ReaderCloseButton onClose={onClose} />
      </div>

      {/* data-scrollable: outer React touch handler skips this; native non-passive listener handles overscroll */}
      <div data-scrollable ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4 space-y-2 scrollbar-hide">
        {chapters.map((ch) => {
          const readable = ch.sentences.filter((s) => s.style !== 'spacer');
          const readCount = Math.min(ch.nextSentenceIndex, readable.length);
          const isCurrent = ch.id === activeChapterId;
          const isLocked = !ch.unlocked;
          const isComplete = ch.complete;
          const isNew = !isComplete && readCount === 0 && !isLocked;
          const isInProgress = !isComplete && readCount > 0 && !isLocked;

          return (
            <button
              key={ch.id}
              type="button"
              disabled={isLocked}
              onClick={() => !isLocked && onSelect(ch)}
              className={`w-full text-left rounded-2xl px-4 py-3 transition-all duration-150 ${
                isLocked
                  ? 'opacity-35 cursor-default'
                  : isCurrent
                    ? 'bg-black/[0.06] active:bg-black/[0.10]'
                    : 'active:bg-black/[0.05]'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Status mark */}
                <div className="shrink-0 w-5 flex items-center justify-center">
                  {isComplete ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth={2.5} strokeLinecap="round" className="h-4 w-4">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : isLocked ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="h-4 w-4 text-black/30">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ) : (
                    <span className="text-[11px] font-semibold tabular-nums text-black/25">
                      {String(ch.chapterNum).padStart(2, '0')}
                    </span>
                  )}
                </div>

                {/* Title */}
                <p className={`flex-1 min-w-0 truncate text-[15px] font-medium leading-none ${isLocked ? 'text-black/40' : 'text-[#0a0a0b]'}`}>
                  {ch.title}
                </p>

                {/* Chevron for available chapters */}
                {!isLocked && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="h-4 w-4 shrink-0 text-black/20">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

// ─── Chapter Start view ────────────────────────────────────────────────────

function ChapterStartView({
  chapter,
  onBegin,
  onBack,
}: {
  chapter: CampaignChapterWithProgress;
  onBegin: () => void;
  onBack: () => void;
}) {
  const readable = chapter.sentences.filter((s) => s.style !== 'spacer');
  const readCount = Math.min(chapter.nextSentenceIndex, readable.length);
  const isNew = readCount === 0;
  const isComplete = chapter.complete;

  return (
    <div className="flex flex-col h-full w-full animate-in fade-in duration-150">
      {/* Back */}
      <div className="shrink-0 px-5 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-black/35 hover:text-black/60 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="text-[13px] font-medium">The Story</span>
        </button>
      </div>

      {/* Content — vertically centered, editorial */}
      <div className="flex-1 flex flex-col items-start justify-center px-8 gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/25">
          Chapter {String(chapter.chapterNum).padStart(2, '0')}
        </p>
        <h2 className="text-[34px] font-bold text-[#0a0a0b] leading-[1.1] tracking-tight">
          {chapter.title}
        </h2>
        {chapter.subtitle && (
          <p className="text-[16px] text-black/45 leading-snug">{chapter.subtitle}</p>
        )}
        {/* Simple text status — no bars */}
        <p className="text-[13px] mt-1">
          {isComplete ? (
            <span className="text-[#34C759]/80">Completed</span>
          ) : isNew ? (
            <span className="text-black/30">{readable.length} {readable.length === 1 ? 'page' : 'pages'}</span>
          ) : (
            <span className="text-black/35">{readCount} of {readable.length} pages read</span>
          )}
        </p>
      </div>

      {/* Begin button */}
      <div className="shrink-0 px-8 pb-12">
        <button
          type="button"
          onClick={onBegin}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0a0a0b] py-4 text-[16px] font-semibold text-white transition-all active:scale-[0.98]"
        >
          {isNew ? 'Begin' : isComplete ? 'Re-read' : 'Continue'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Reading view ──────────────────────────────────────────────────────────

function ReadingView({
  chapter,
  onSentenceRead,
  onFinish,
  onClose,
}: {
  chapter: CampaignChapterWithProgress;
  onSentenceRead: (chapterId: number, sentenceId: number) => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  const readable = chapter.sentences.filter((s) => s.style !== 'spacer');
  const startIdx = (() => {
    const ni = chapter.nextSentenceIndex;
    const fullSentence = chapter.sentences[ni];
    if (!fullSentence) return 0;
    const ridx = readable.findIndex((s) => s.id === fullSentence.id);
    return ridx >= 0 ? ridx : 0;
  })();

  const [idx, setIdx] = useState(startIdx);
  const readRef = useRef(new Set<number>());
  const startXRef = useRef<number | null>(null);

  const current = readable[idx] ?? null;
  const isLast = idx === readable.length - 1;

  const markCurrent = useCallback(() => {
    if (!current || readRef.current.has(current.id)) return;
    readRef.current.add(current.id);
    onSentenceRead(chapter.id, current.id);
  }, [current, chapter.id, onSentenceRead]);

  useEffect(() => { markCurrent(); }, [idx, markCurrent]);

  const advance = useCallback(() => {
    if (isLast) { onFinish(); return; }
    setIdx((i) => Math.min(i + 1, readable.length - 1));
  }, [isLast, onFinish, readable.length]);

  const back = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const startX = startXRef.current;
    if (startX == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - startX;
    startXRef.current = null;
    if (Math.abs(dx) < 40) { advance(); return; }
    if (dx < 0) advance(); else back();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advance(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, back]);

  if (!current) return null;

  const progressPct = readable.length > 1 ? (idx / (readable.length - 1)) * 100 : 100;

  return (
    <div
      className="flex flex-col h-full w-full animate-in fade-in duration-150"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Thin reading progress line — sits flush at the very top */}
      <div className="shrink-0 h-[2px] w-full bg-black/[0.06]">
        <div
          className="h-full bg-[#0a0a0b]/30 transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Header — chapter label left, close right */}
      <div
        className="flex items-center justify-between gap-3 px-5 pb-3 shrink-0"
        style={{ paddingTop: safePadTop('1rem') }}
      >
        <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-widest text-black/25">
          {String(chapter.chapterNum).padStart(2, '0')} — {chapter.title}
        </span>
        <ReaderCloseButton onClose={onClose} />
      </div>

      {/* Sentence — left half = back, right half = advance */}
      <div className="relative flex-1 flex items-center justify-center px-8 w-full">
        <p
          key={current.id}
          className={`max-w-[520px] w-full leading-[1.55] tracking-tight animate-in fade-in slide-in-from-right-4 duration-300 ${
            current.style === 'em'
              ? 'text-[22px] font-bold text-[#0a0a0b]'
              : current.style === 'heading'
                ? 'text-[18px] font-bold uppercase tracking-widest text-black/40'
                : 'text-[19px] font-medium text-black/80'
          }`}
        >
          {current.content}
        </p>
        <button
          type="button"
          onClick={back}
          disabled={idx === 0}
          aria-label="Previous"
          className="absolute inset-y-0 left-0 w-1/2 disabled:cursor-default"
        />
        <button
          type="button"
          onClick={advance}
          aria-label={isLast ? 'Finish chapter' : 'Next'}
          className="absolute inset-y-0 right-0 w-1/2"
        />
      </div>

      {/* Footer — page counter + prev/next */}
      <div className="shrink-0 flex items-center justify-between px-5 pb-8 pt-2">
        <button
          type="button"
          onClick={back}
          disabled={idx === 0}
          aria-label="Previous"
          className="h-8 w-8 flex items-center justify-center rounded-full text-black/20 hover:text-black/45 disabled:opacity-0 transition-all"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="h-5 w-5">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <span
          className="text-[12px] font-medium tabular-nums text-black/20"
          aria-label={`Page ${idx + 1} of ${readable.length}`}
        >
          {idx + 1} / {readable.length}
        </span>

        <button
          type="button"
          onClick={advance}
          aria-label={isLast ? 'Finish' : 'Next'}
          className="h-8 w-8 flex items-center justify-center rounded-full text-black/35 hover:text-black/65 transition-all"
        >
          {isLast ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="h-5 w-5">
              <path d="m9 18 6-6-6-6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────

export function CampaignReader({ chapters, initialChapter, onClose, onSentenceRead }: Props) {
  const [view, setView] = useState<ReaderView>('index');
  const [currentChapter, setCurrentChapter] = useState(initialChapter);

  // ── Sheet animation ────────────────────────────────────────────────────
  const [phase, setPhase] = useState<SheetPhase>('entering');
  const [dragY, setDragY] = useState(0);

  // Mirror dragY in a ref so closures inside useEffect never read stale state
  const dragYRef = useRef(0);
  const updateDragY = useCallback((val: number) => {
    dragYRef.current = val;
    setDragY(val);
  }, []);

  // Gesture tracking — all mutable refs, no re-renders during gesture
  const dragStartY = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragLastY = useRef(0);
  const dragLastTime = useRef(0);
  const dragVelocity = useRef(0); // px/ms, negative = upward
  const dragAxis = useRef<'v' | 'h' | null>(null);

  // Chapter list scroll container — wired via ChapterIndexView prop
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Enter: slide down from top ─────────────────────────────────────────
  // Double-RAF gives the browser one frame to commit translateY(-100%) before animating
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setPhase('open')),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Shared dismiss decision — used by both gesture sources ─────────────
  const settleDismiss = useCallback(() => {
    if (dragYRef.current < DISMISS_DISTANCE || dragVelocity.current < DISMISS_VELOCITY) {
      setPhase('closing');
      setTimeout(() => onClose(), 340);
    } else {
      updateDragY(0);
      setPhase('open');
    }
  }, [onClose, updateDragY]);

  // Animate out then unmount
  const closeWithAnimation = useCallback(() => {
    setPhase('closing');
    setTimeout(() => onClose(), 340);
  }, [onClose]);

  // ── Overscroll-to-dismiss on the chapter list ──────────────────────────
  // Uses a non-passive native listener so preventDefault actually works
  // (React's synthetic onTouchMove is passive in newer versions and can't stop scroll)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || view !== 'index') return;

    let startY = 0;
    let locked = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startY = t.clientY;
      locked = false;
      dragVelocity.current = 0;
      dragLastY.current = t.clientY;
      dragLastTime.current = performance.now();
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const fingerDy = t.clientY - startY; // negative = moved up

      // Lock once the finger has clearly scrolled past the bottom of the list
      const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
      if (!locked && atBottom && fingerDy < -8) locked = true;

      if (!locked) return;

      // Own the gesture — stop browser scroll, drive sheet instead
      e.preventDefault();
      const now = performance.now();
      const dt = now - dragLastTime.current;
      if (dt > 0) dragVelocity.current = (t.clientY - dragLastY.current) / dt;
      dragLastY.current = t.clientY;
      dragLastTime.current = now;
      updateDragY(fingerDy < 0 ? fingerDy : fingerDy * 0.12);
      setPhase('dragging');
    };

    const onEnd = () => {
      if (!locked) return;
      locked = false;
      settleDismiss();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false }); // must be non-passive
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [view, settleDismiss, updateDragY]);

  // ── View transitions ───────────────────────────────────────────────────
  // Views animate themselves in via CSS; the container stays opaque throughout
  const selectChapter = useCallback(
    (ch: CampaignChapterWithProgress) => {
      setCurrentChapter(ch);
      const readable = ch.sentences.filter((s) => s.style !== 'spacer');
      const isInProgress = !ch.complete && ch.nextSentenceIndex > 0 && readable.length > 0;
      setView(isInProgress ? 'reading' : 'chapter-start');
    },
    [],
  );

  const beginReading = useCallback(() => setView('reading'), []);
  const backToIndex = useCallback(() => setView('index'), []);
  const handleFinish = useCallback(() => setView('index'), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'reading') backToIndex();
        else closeWithAnimation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, backToIndex, closeWithAnimation]);

  // ── Outer swipe-up-to-dismiss (handle area + non-scroll views) ─────────
  // Skips any touch that starts inside [data-scrollable] — those are owned
  // by the native listener above.
  const onSheetTouchStart = (e: React.TouchEvent) => {
    if ((e.target as Element).closest('[data-scrollable]')) return;
    const t = e.touches[0];
    if (!t) return;
    dragStartY.current = t.clientY;
    dragStartX.current = t.clientX;
    dragLastY.current = t.clientY;
    dragLastTime.current = performance.now();
    dragVelocity.current = 0;
    dragAxis.current = null;
  };

  const onSheetTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current == null) return;
    const t = e.touches[0];
    if (!t) return;
    const dy = t.clientY - dragStartY.current;
    const dx = t.clientX - (dragStartX.current ?? t.clientX);
    if (dragAxis.current === null) {
      if (Math.abs(dy) > Math.abs(dx) + 4 && dy < 0) dragAxis.current = 'v';
      else if (Math.abs(dx) > Math.abs(dy) + 4) dragAxis.current = 'h';
      else return;
    }
    if (dragAxis.current !== 'v') return;
    const now = performance.now();
    const dt = now - dragLastTime.current;
    if (dt > 0) dragVelocity.current = (t.clientY - dragLastY.current) / dt;
    dragLastY.current = t.clientY;
    dragLastTime.current = now;
    updateDragY(dy < 0 ? dy : dy * 0.12);
    setPhase('dragging');
    e.preventDefault();
  };

  const onSheetTouchEnd = () => {
    const wasV = dragAxis.current === 'v';
    dragStartY.current = null;
    dragStartX.current = null;
    dragAxis.current = null;
    if (!wasV) return;
    settleDismiss();
  };

  // ── Sheet style ────────────────────────────────────────────────────────
  const translateY =
    phase === 'entering' ? '-100%' :
    phase === 'closing'  ? '-100%' :
    phase === 'dragging' ? `${dragY}px` :
    '0%';

  const sheetTransition =
    phase === 'dragging'
      ? 'none'
      : phase === 'closing'
        ? 'transform 320ms cubic-bezier(0.55, 0, 1, 0.45)'
        : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';

  const content = (
    <div
      className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} flex flex-col bg-white`}
      style={{ transform: `translateY(${translateY})`, transition: sheetTransition }}
      role="dialog"
      aria-modal="true"
      aria-label="Story"
      onTouchStart={onSheetTouchStart}
      onTouchMove={onSheetTouchMove}
      onTouchEnd={onSheetTouchEnd}
    >
      {/* Views fill the available space; handle is pinned below */}
      <div className="flex-1 min-h-0">
        {view === 'index' && (
          <ChapterIndexView
            chapters={chapters}
            activeChapterId={currentChapter.id}
            onSelect={selectChapter}
            onClose={closeWithAnimation}
            scrollRef={scrollRef}
          />
        )}
        {view === 'chapter-start' && (
          <ChapterStartView
            chapter={currentChapter}
            onBegin={beginReading}
            onBack={backToIndex}
          />
        )}
        {view === 'reading' && (
          <ReadingView
            key={currentChapter.id}
            chapter={currentChapter}
            onSentenceRead={onSentenceRead}
            onFinish={handleFinish}
            onClose={closeWithAnimation}
          />
        )}
      </div>

      {/* Drag handle at bottom — mirrors how the dock handle sits at its leading edge */}
      <div
        className="shrink-0 flex justify-center pt-2"
        style={{ paddingBottom: safePadBottom('0.75rem') }}
      >
        <div className="w-9 h-[3px] rounded-full bg-black/20" />
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
