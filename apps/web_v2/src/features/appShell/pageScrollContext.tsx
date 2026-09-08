'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from 'react';

export type PageScrollListener = (event: UIEvent<HTMLDivElement>) => void;

type PageScrollContextValue = {
  subscribe: (listener: PageScrollListener) => () => void;
};

const PageScrollContext = createContext<PageScrollContextValue | null>(null);

export function usePageScrollContext() {
  return useContext(PageScrollContext);
}

/** Subscribe to the nearest ancestor `PageScroll` column. */
export function usePageScrollListener(listener: PageScrollListener) {
  const ctx = usePageScrollContext();
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(listener);
  }, [ctx, listener]);
}

export function usePageScrollListenerRef() {
  const listenersRef = useRef(new Set<PageScrollListener>());

  const subscribe = useCallback((listener: PageScrollListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const notify = useCallback((event: UIEvent<HTMLDivElement>) => {
    for (const listener of listenersRef.current) {
      listener(event);
    }
  }, []);

  return useMemo(
    () => ({
      subscribe,
      notify,
    }),
    [subscribe, notify],
  );
}

export function PageScrollContextProvider({
  value,
  children,
}: {
  value: PageScrollContextValue;
  children: React.ReactNode;
}) {
  return (
    <PageScrollContext.Provider value={value}>{children}</PageScrollContext.Provider>
  );
}

const SCROLL_DELTA_PX = 6;

/**
 * Hide chrome when the user scrolls down into content; reveal when scrolling back up.
 */
export function useScrollRevealFab() {
  const [visible, setVisible] = useState(true);
  const lastYRef = useRef(0);

  usePageScrollListener(
    useCallback((event: UIEvent<HTMLDivElement>) => {
      const y = event.currentTarget.scrollTop;
      if (y <= 4) {
        setVisible(true);
        lastYRef.current = y;
        return;
      }
      const delta = y - lastYRef.current;
      if (delta > SCROLL_DELTA_PX) setVisible(false);
      else if (delta < -SCROLL_DELTA_PX) setVisible(true);
      lastYRef.current = y;
    }, []),
  );

  return visible;
}
