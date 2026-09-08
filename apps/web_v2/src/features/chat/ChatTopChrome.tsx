'use client';

import type { ReactNode } from 'react';
import {
  AccountAvatar,
  getAccountDisplayName,
  getAccountHandle,
  useAuthSafe,
} from '@/features/auth';
import { useAccountMenuSafe } from '@/features/appShell/AccountMenuContext';
import { IconSidebar } from '@/features/map/dockCore/core/icons';
import { safePadTop } from '@/lib/despia/safeArea';

type ChatTopChromeProps = {
  title?: string;
  /** When set, replaces the centered title (e.g. editable thread name). */
  titleSlot?: ReactNode;
  right?: ReactNode;
  threadsOpen?: boolean;
  onOpenThreads?: () => void;
};

/**
 * Chat header — sidebar (threads) left of account avatar. Overlay sidebar does
 * not push content; account avatar still opens the Own account drawer.
 */
export default function ChatTopChrome({
  title = 'Helpdesk',
  titleSlot,
  right,
  threadsOpen = false,
  onOpenThreads,
}: ChatTopChromeProps) {
  const { account, user, isLoading } = useAuthSafe();
  const { open, toggleDrawer } = useAccountMenuSafe();
  const label = getAccountDisplayName(account, user?.email);
  const handle = getAccountHandle(account);

  return (
    <header
      className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
      style={{ paddingTop: safePadTop('0.2rem') }}
      data-chat-top-chrome=""
    >
      <div className="relative flex h-11 items-center gap-1.5 px-3">
        <button
          type="button"
          onClick={onOpenThreads}
          aria-label="Open threads"
          aria-expanded={threadsOpen}
          aria-controls="chat-threads-sidebar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground transition active:bg-black/[0.06]"
        >
          <IconSidebar className="h-[1.35rem] w-[1.35rem]" />
        </button>

        <button
          type="button"
          onClick={toggleDrawer}
          aria-label={handle ? `Account ${handle}` : label ? `Account ${label}` : 'Account'}
          aria-expanded={open}
          aria-controls="app-account-drawer"
          aria-hidden={open}
          tabIndex={open ? -1 : undefined}
          className={`relative z-[1] h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/[0.06] transition-[opacity,transform] active:scale-95 ${
            open ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          <AccountAvatar
            account={account}
            email={user?.email}
            size="sm"
            loading={isLoading && !account}
            className="h-8 w-8"
          />
        </button>

        <div className="min-w-0 flex-1 px-1">
          {titleSlot ?? (
            <h1 className="truncate text-center text-[17px] font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          )}
        </div>

        <div className="flex h-9 min-w-[5.5rem] shrink-0 items-center justify-end">
          {right ?? <span className="h-9 w-9" aria-hidden />}
        </div>
      </div>
    </header>
  );
}
