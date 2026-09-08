'use client';

/**
 * CampaignCard — hamburger button in the top-left of /game.
 *
 * Always shows as a compact icon button; tapping opens CampaignReader
 * (full chapter list + sentence stepper). A blue badge marks the active
 * chapter number when unread content is available.
 */

import { useCallback, useState } from 'react';
import { useCampaign } from './useCampaign';
import { CampaignReader } from './CampaignReader';
import { useDemoMapChrome } from '@/features/setup/DemoMapChromeContext';

export function CampaignCard() {
  const demo = useDemoMapChrome();
  const { chapters, loading, markRead } = useCampaign();
  const [readerOpen, setReaderOpen] = useState(false);

  const handleSentenceRead = useCallback((chapterId: number, sentenceId: number) => {
    void markRead(chapterId, [sentenceId]);
  }, [markRead]);

  if (demo !== null) return null;
  if (loading || !chapters.length) return null;

  const activeChapter = (() => {
    const incompleteUnlocked = chapters.find((c) => c.unlocked && !c.complete);
    if (incompleteUnlocked) return incompleteUnlocked;
    return [...chapters].reverse().find((c) => c.unlocked && c.complete) ?? null;
  })();

  const hasUnread = activeChapter
    ? !activeChapter.complete &&
      activeChapter.nextSentenceIndex < activeChapter.sentences.filter((s) => s.style !== 'spacer').length
    : false;

  return (
    <>
      <button
        type="button"
        onClick={() => setReaderOpen(true)}
        aria-label="Open story chapters"
        className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-all duration-150 active:scale-[0.93]"
      >
        {/* Hamburger icon */}
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
          <rect x="3" y="5.5" width="14" height="1.5" rx="0.75" fill="#1C1C1E" />
          <rect x="3" y="9.25" width="14" height="1.5" rx="0.75" fill="#1C1C1E" />
          <rect x="3" y="13" width="14" height="1.5" rx="0.75" fill="#1C1C1E" />
        </svg>

        {/* Chapter badge — only when there's unread content */}
        {activeChapter && hasUnread && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#007AFF] px-1 text-[9px] font-bold leading-none text-white">
            {activeChapter.chapterNum}
          </span>
        )}
      </button>

      {readerOpen && activeChapter && (
        <CampaignReader
          chapters={chapters}
          initialChapter={activeChapter}
          onClose={() => setReaderOpen(false)}
          onSentenceRead={handleSentenceRead}
        />
      )}
    </>
  );
}
