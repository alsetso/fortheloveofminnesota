'use client';

/**
 * Shared full-screen interactive sheet shell (Contacts, Create Post, …).
 *
 * Despia pattern (prevent-autoscroll + visualViewport):
 * - Root stays `absolute inset-0` on the layout viewport — never shrinks with
 *   the keyboard, so the sheet fills the screen behind iOS keyboard chrome.
 * - Overlay header / scroll body / footer slots (glass chrome floats over list).
 * - Footer + side chrome opt into `--keyboard-inset` so search/actions ride up
 *   with the keyboard while the sheet backdrop stays put.
 *
 * Product UI owns header/footer/children; this only owns structure + insets.
 *
 * @see https://setup.despia.com/best-practices/frontend/structure
 * @see https://setup.despia.com/native-features/prevent-autoscroll
 */

import type { CSSProperties, ReactNode, Ref } from 'react';
import {
  safeClearBottomKeyboard,
  safeClearTop,
  safePadBottomKeyboard,
  safePadTop,
} from '@/lib/despia/safeArea';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

export type FullScreenSheetShellProps = {
  /** Dialog label for the full-screen sheet. */
  ariaLabel: string;
  /** Play enter animation once on mount. */
  entering?: boolean;
  onEnterEnd?: () => void;
  /** Floating top chrome (back, title, actions). */
  header: ReactNode;
  /**
   * Floating bottom chrome (search + add). Omit/null on detail / compose pages.
   * Bottom edge lifts with max(safe-area, keyboard-inset).
   */
  footer?: ReactNode | null;
  /**
   * Optional edge chrome (A–Z index). Bottom clears footer + keyboard.
   */
  sideChrome?: ReactNode | null;
  /** Scrollable stage — list, detail, or compose body. */
  children: ReactNode;
  bodyRef?: Ref<HTMLDivElement>;
  /** Extra top clear for scroll content (header height without safe area). */
  headerClear?: string;
  /**
   * Extra bottom clear for scroll content when a footer is shown
   * (footer height without safe/keyboard inset).
   */
  footerClear?: string;
  /** Bottom clear when there is no footer (detail / compose). */
  bodyBottomClear?: string;
  /** Top inset for side chrome under the header. */
  sideChromeTop?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Full-bleed sheet frame: fixed layout viewport, keyboard-aware footer.
 */
export default function FullScreenSheetShell({
  ariaLabel,
  entering = false,
  onEnterEnd,
  header,
  footer = null,
  sideChrome = null,
  children,
  bodyRef,
  headerClear = '3.5rem',
  footerClear = '4rem',
  bodyBottomClear = '1.5rem',
  sideChromeTop = '3.75rem',
  className = '',
  style,
}: FullScreenSheetShellProps) {
  const showFooter = footer != null;

  return (
    <div
      className={`full-screen-sheet-shell pointer-events-auto absolute inset-0 ${Z_LAYER_CLASS.SHEET} overflow-hidden bg-white text-[#1C1C1E] ${
        entering ? 'full-screen-sheet-shell-enter' : ''
      } ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onAnimationEnd={onEnterEnd}
      style={style}
      data-full-screen-sheet-shell=""
      data-keyboard-aware-footer={showFooter ? '' : undefined}
    >
      {/* Scroll stage — fills the sheet; chrome floats above */}
      <div
        ref={bodyRef}
        className="full-screen-sheet-shell-scroll absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-white [-webkit-overflow-scrolling:touch]"
        style={{
          paddingTop: safeClearTop(headerClear),
          paddingBottom: showFooter
            ? safeClearBottomKeyboard(footerClear)
            : safeClearBottomKeyboard(bodyBottomClear),
        }}
      >
        {children}
      </div>

      {/* Header: stays under status bar; does not move with keyboard */}
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-20"
        style={{ paddingTop: safePadTop('0.75rem') }}
        data-sheet-chrome="header"
      >
        {header}
      </header>

      {sideChrome != null ? (
        <div
          className="pointer-events-auto absolute right-0 z-20"
          style={{
            top: safePadTop(sideChromeTop),
            bottom: showFooter
              ? safeClearBottomKeyboard(footerClear)
              : safeClearBottomKeyboard(bodyBottomClear),
          }}
          data-sheet-chrome="side"
        >
          {sideChrome}
        </div>
      ) : null}

      {/* Footer: rides above home indicator OR keyboard; sheet stays full-bleed */}
      {showFooter ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30"
          style={{ paddingBottom: safePadBottomKeyboard('0.5rem') }}
          data-sheet-chrome="footer"
        >
          {footer}
        </div>
      ) : null}

      <style>{`
        @keyframes fullScreenSheetShellIn {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .full-screen-sheet-shell-enter {
          animation: fullScreenSheetShellIn 0.34s cubic-bezier(0.2, 0, 0, 1) both;
        }
        .full-screen-sheet-shell-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .full-screen-sheet-shell-scroll::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
    </div>
  );
}
