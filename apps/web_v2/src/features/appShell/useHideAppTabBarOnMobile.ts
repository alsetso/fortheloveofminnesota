'use client';

import { useEffect, useState } from 'react';
import { isDespia } from '@/lib/despia/despia';

/** Phone / Despia shell — bottom tab bar is hidden; navigate via TopBar + account. */
export const APP_TAB_BAR_MOBILE_MAX_WIDTH_PX = 767;

function readHideTabBar(): boolean {
  if (typeof window === 'undefined') return false;
  if (isDespia()) return true;
  return window.matchMedia(
    `(max-width: ${APP_TAB_BAR_MOBILE_MAX_WIDTH_PX}px)`,
  ).matches;
}

/**
 * True when the Own tab bar should stay off (native Despia or narrow viewport).
 * Desktop-wide browser previews keep the tab bar for Feed · Map · Profile.
 */
export function useHideAppTabBarOnMobile(): boolean {
  const [hide, setHide] = useState(readHideTabBar);

  useEffect(() => {
    setHide(readHideTabBar());
    if (isDespia()) return;

    const mq = window.matchMedia(
      `(max-width: ${APP_TAB_BAR_MOBILE_MAX_WIDTH_PX}px)`,
    );
    const onChange = () => setHide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return hide;
}
