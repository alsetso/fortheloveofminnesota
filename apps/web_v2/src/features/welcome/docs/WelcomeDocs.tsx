'use client';

import { useEffect, useId, useRef, useState } from 'react';
import BrandHeart from '@/features/welcome/screen/BrandHeart';
import HowItWorksGuide from '@/features/welcome/docs/HowItWorksGuide';
import { WELCOME_DOC_TOPICS } from '@/features/welcome/docs/welcomeStories';

export type { WelcomeStory as DocTopic } from '@/features/welcome/docs/welcomeStories';
export { WELCOME_DOC_TOPICS };

const INK = '#2C2825';
const MUTED = '#7A736C';
const LINE = '#E0D9CE';
const CARD = '#FFFaf5';
const ACCENT = '#2F5D4A';
const LOVE = '#C23B3B';
const ROW = '#FFFdf9';

type WelcomeDocsProps = {
  className?: string;
  /** When false, topic rows don’t open sheets (splash / loading). */
  interactive?: boolean;
};

export default function WelcomeDocs({
  className = '',
  interactive = true,
}: WelcomeDocsProps) {
  const baseId = useId();
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const activeIndex = WELCOME_DOC_TOPICS.findIndex((t) => t.id === activeSheetId);
  const activeTopic = activeIndex >= 0 ? WELCOME_DOC_TOPICS[activeIndex]! : null;
  const prevTopic = activeIndex > 0 ? WELCOME_DOC_TOPICS[activeIndex - 1]! : null;
  const nextTopic =
    activeIndex >= 0 && activeIndex < WELCOME_DOC_TOPICS.length - 1
      ? WELCOME_DOC_TOPICS[activeIndex + 1]!
      : null;

  useEffect(() => {
    if (!activeSheetId) return;
    sheetRef.current?.focus();
  }, [activeSheetId]);

  const openSheet = (id: string) => {
    if (!interactive) return;
    setActiveSheetId(id);
  };

  const closeSheet = () => setActiveSheetId(null);

  return (
    <div className={`flex h-full min-h-0 w-full flex-col ${className}`}>
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] shadow-sm shadow-[#2C2825]/06"
        style={{ backgroundColor: CARD, border: `1px solid ${LINE}` }}
        aria-label="Welcome to For the Love of Minnesota"
      >
        {activeTopic ? (
          <div
            ref={sheetRef}
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col outline-none"
            role="region"
            aria-labelledby={`${baseId}-sheet-title`}
          >
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <div
                key={activeTopic.id}
                className="welcome-sheet-in scrollbar-hide absolute inset-0 overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch]"
              >
                <h2
                  id={`${baseId}-sheet-title`}
                  className="text-[1.25rem] font-semibold leading-snug tracking-tight"
                  style={{
                    color: INK,
                    fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
                  }}
                >
                  {activeTopic.sheetTitle}
                </h2>

                <p className="mt-3 text-[0.95rem] font-medium leading-snug" style={{ color: MUTED }}>
                  {activeTopic.summary}
                </p>

                <div className="mt-5 flex flex-col gap-5">
                  {activeTopic.sections.map((section) => (
                    <div key={section.heading ?? section.body.slice(0, 24)}>
                      {section.heading ? (
                        <h3
                          className="text-[15px] font-semibold tracking-tight"
                          style={{ color: INK }}
                        >
                          {section.heading}
                        </h3>
                      ) : null}
                      <p
                        className={`text-[0.95rem] leading-relaxed ${section.heading ? 'mt-1.5' : ''}`}
                        style={{ color: MUTED }}
                      >
                        {section.body}
                      </p>
                    </div>
                  ))}
                </div>

                <p
                  className="mt-6 border-t pt-4 text-[0.95rem] font-semibold leading-snug"
                  style={{ color: INK, borderColor: LINE }}
                >
                  {activeTopic.ask}
                </p>

                {activeTopic.showTools ? (
                  <div className="mt-6 border-t pt-5" style={{ borderColor: LINE }}>
                    <HowItWorksGuide />
                  </div>
                ) : null}
              </div>
            </div>

            <nav
              className="relative flex shrink-0 items-stretch gap-2 border-t px-3 py-2.5"
              style={{ borderColor: LINE }}
              aria-label="More about the app"
            >
              <div className="flex min-w-0 flex-1 items-center">
                {prevTopic ? (
                  <button
                    type="button"
                    onClick={() => openSheet(prevTopic.id)}
                    className="despia-touch-target flex min-w-0 w-full items-center gap-1 rounded-xl px-2 py-2.5 text-left transition active:opacity-70"
                    style={{ color: ACCENT }}
                  >
                    <ChevronLeftIcon />
                    <span className="min-w-0">
                      <span className="block text-[10px] font-medium uppercase tracking-wide" style={{ color: MUTED }}>
                        Previous
                      </span>
                      <span className="block truncate text-[13px] font-semibold leading-snug">
                        {prevTopic.title}
                      </span>
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeSheet}
                    className="despia-touch-target flex min-w-0 w-full items-center gap-1 rounded-xl px-2 py-2.5 text-left transition active:opacity-70"
                    style={{ color: ACCENT }}
                    aria-label="Back to cover"
                  >
                    <ChevronLeftIcon />
                    <span className="min-w-0">
                      <span className="block text-[10px] font-medium uppercase tracking-wide" style={{ color: MUTED }}>
                        Back
                      </span>
                      <span className="block truncate text-[13px] font-semibold leading-snug">
                        Cover
                      </span>
                    </span>
                  </button>
                )}
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <div
                  className="pointer-events-auto flex w-auto items-center gap-1 rounded-full px-1.5 py-1"
                  role="tablist"
                  aria-label="Sections"
                >
                  {WELCOME_DOC_TOPICS.map((topic, i) => (
                    <button
                      key={topic.id}
                      type="button"
                      role="tab"
                      onClick={() => openSheet(topic.id)}
                      className="flex h-5 w-3 items-center justify-center"
                      aria-label={topic.title}
                      aria-selected={i === activeIndex}
                    >
                      <span
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: i === activeIndex ? 12 : 5,
                          backgroundColor: i === activeIndex ? ACCENT : '#C9C2B6',
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end">
                {nextTopic ? (
                  <button
                    type="button"
                    onClick={() => openSheet(nextTopic.id)}
                    className="despia-touch-target flex min-w-0 w-full items-center justify-end gap-1 rounded-xl px-2 py-2.5 text-right transition active:opacity-70"
                    style={{ color: ACCENT }}
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] font-medium uppercase tracking-wide" style={{ color: MUTED }}>
                        Next
                      </span>
                      <span className="block truncate text-[13px] font-semibold leading-snug">
                        {nextTopic.title}
                      </span>
                    </span>
                    <ChevronRightIcon />
                  </button>
                ) : null}
              </div>
            </nav>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-center px-5 py-6">
            <div className="mx-auto flex w-full max-w-sm flex-col">
              <header className="flex flex-col items-center text-center">
                <BrandHeart className="mb-3.5 h-9 w-9" color={LOVE} />
                <h1
                  className="max-w-[17rem] text-[1.4rem] font-semibold leading-snug tracking-tight"
                  style={{
                    color: INK,
                    fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
                  }}
                >
                  For the Love of Minnesota
                </h1>
                <p className="mt-3 max-w-[19rem] text-[0.95rem] leading-relaxed" style={{ color: MUTED }}>
                  Stand together. Work together. Share resources. Tools for your block — and your
                  neighbors.
                </p>
                <p className="mt-2 max-w-[19rem] text-[0.95rem] leading-relaxed" style={{ color: MUTED }}>
                  Look around. Come on in.
                </p>
              </header>

              <div className="mt-6" role="list" aria-label="Learn more">
                {WELCOME_DOC_TOPICS.map((topic) => (
                  <div
                    key={topic.id}
                    role="listitem"
                    className="mb-2 overflow-hidden rounded-2xl border"
                    style={{ backgroundColor: ROW, borderColor: LINE }}
                  >
                    <button
                      type="button"
                      onClick={() => openSheet(topic.id)}
                      className="despia-touch-target flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition active:scale-[0.99]"
                      aria-label={`${topic.title}. ${topic.summary}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold tracking-tight" style={{ color: INK }}>
                          {topic.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: MUTED }}>
                          {topic.summary}
                        </span>
                      </span>
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        style={{ color: ACCENT, backgroundColor: `${ACCENT}14` }}
                        aria-hidden
                      >
                        <ChevronRightIcon />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes welcomeSheetIn {
          from { opacity: 0; transform: translateX(18px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .welcome-sheet-in { animation: welcomeSheetIn 0.28s ease-out both; }
      `}</style>
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
