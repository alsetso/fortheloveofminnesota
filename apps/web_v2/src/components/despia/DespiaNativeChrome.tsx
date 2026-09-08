'use client';

/**
 * Despia native chrome bootstrap:
 * 1. Disable WebView keyboard autoscroll (no native jump / white gap).
 * 2. Track keyboard inset via visualViewport — keep the fixed root full-screen.
 *    Map explore dock stays pinned; keyboard overlays it. `--keyboard-inset` /
 *    `.keyboard-visible` remain available for screens that opt into clearing
 *    (e.g. FullScreenSheetShell footer rides up with max(safe-area, keyboard)).
 * 3. Block Safari/WKWebView page pinch-zoom (gesture*) so fixed TopBar / TabBar
 *    never lose safe-area spacing. Mapbox pinch uses touch events, not gesture*.
 *
 * @see https://setup.despia.com/best-practices/frontend/structure
 * @see https://setup.despia.com/native-features/prevent-autoscroll
 */

import { useEffect } from 'react';
import { disableDespiaAutoscroll } from '@/lib/despia/preventAutoscroll';

const KEYBOARD_VISIBLE_RATIO = 0.75;

function syncKeyboardInset(): void {
  const root = document.documentElement;
  const vv = window.visualViewport;

  // Layout viewport stays put — never offset/shrink the app shell.
  root.style.setProperty('--vv-height', '100%');
  root.style.setProperty('--vv-offset-top', '0px');

  if (!vv) {
    root.style.setProperty('--keyboard-inset', '0px');
    document.body.classList.remove('keyboard-visible');
    return;
  }

  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  root.style.setProperty('--keyboard-inset', `${inset}px`);

  const keyboardVisible = vv.height < window.innerHeight * KEYBOARD_VISIBLE_RATIO;
  document.body.classList.toggle('keyboard-visible', keyboardVisible);

  // Undo any native/page scroll the WebView may still apply.
  if (keyboardVisible && (window.scrollY !== 0 || window.scrollX !== 0)) {
    window.scrollTo(0, 0);
  }
  if (vv.offsetTop !== 0) {
    // visualViewport scrolled — pin document so the shell doesn't appear lifted.
    window.scrollTo(0, 0);
  }
}

function preventPageZoomGesture(event: Event): void {
  event.preventDefault();
}

/** Mount once under Providers — side effects only. */
export default function DespiaNativeChrome() {
  useEffect(() => {
    void disableDespiaAutoscroll();

    syncKeyboardInset();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', syncKeyboardInset);
    vv?.addEventListener('scroll', syncKeyboardInset);
    window.addEventListener('resize', syncKeyboardInset);
    window.addEventListener('orientationchange', syncKeyboardInset);

    // iOS proprietary page-zoom gestures — capture so chrome stays layout-locked.
    document.addEventListener('gesturestart', preventPageZoomGesture, {
      passive: false,
      capture: true,
    });
    document.addEventListener('gesturechange', preventPageZoomGesture, {
      passive: false,
      capture: true,
    });
    document.addEventListener('gestureend', preventPageZoomGesture, {
      passive: false,
      capture: true,
    });

    return () => {
      vv?.removeEventListener('resize', syncKeyboardInset);
      vv?.removeEventListener('scroll', syncKeyboardInset);
      window.removeEventListener('resize', syncKeyboardInset);
      window.removeEventListener('orientationchange', syncKeyboardInset);
      document.removeEventListener('gesturestart', preventPageZoomGesture, true);
      document.removeEventListener('gesturechange', preventPageZoomGesture, true);
      document.removeEventListener('gestureend', preventPageZoomGesture, true);
    };
  }, []);

  return null;
}
