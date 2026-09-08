'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type UIEvent,
} from 'react';
import {
  PageScrollContextProvider,
  usePageScrollListenerRef,
} from '@/features/appShell/pageScrollContext';

const ShellHeaderSlotContext = createContext<HTMLElement | null>(null);
const ShellChromeActiveContext = createContext(false);

/** Notify PageScroll scroll events to shell-level listeners (e.g. TopBar collapse). */
const ShellScrollNotifyContext = createContext<
  ((event: UIEvent<HTMLDivElement>) => void) | null
>(null);

export function useShellHeaderSlot(): HTMLElement | null {
  return useContext(ShellHeaderSlotContext);
}

/** True when rendering under AppShell’s chrome provider (even before the slot mounts). */
export function useIsAppShellChrome(): boolean {
  return useContext(ShellChromeActiveContext);
}

export function useShellScrollNotify() {
  return useContext(ShellScrollNotifyContext);
}

/**
 * Provides the full-bleed header portal target + a scroll hub so TopBar
 * (portaled into the shell) can still collapse `below` on PageScroll.
 */
export function AppShellChromeProvider({
  children,
}: {
  children: (headerSlotRef: (node: HTMLDivElement | null) => void) => ReactNode;
}) {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const scrollHub = usePageScrollListenerRef();

  const scrollCtx = useMemo(
    () => ({ subscribe: scrollHub.subscribe }),
    [scrollHub.subscribe],
  );

  return (
    <ShellChromeActiveContext.Provider value={true}>
      <ShellHeaderSlotContext.Provider value={headerSlot}>
        <PageScrollContextProvider value={scrollCtx}>
          <ShellScrollNotifyContext.Provider value={scrollHub.notify}>
            {children(setHeaderSlot)}
          </ShellScrollNotifyContext.Provider>
        </PageScrollContextProvider>
      </ShellHeaderSlotContext.Provider>
    </ShellChromeActiveContext.Provider>
  );
}
