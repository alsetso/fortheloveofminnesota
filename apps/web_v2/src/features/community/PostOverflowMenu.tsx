'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { blockAccount } from '@/features/community/blockApi';
import CreatePostSheet from '@/features/community/CreatePostSheet';
import { PostReportSheet } from '@/features/community/PostReportSheet';
import {
  archivePinPost,
  permanentlyDeletePinPost,
  restorePinPost,
} from '@/features/community/pinPostApi';
import { resolvePostLocationSeed } from '@/components/media/capture/PostLocationPanel';
import {
  IconEllipsis,
  IconFlag,
  IconPencil,
  IconShare,
  IconShield,
  IconTrash,
  IconX,
} from '@/features/map/dockCore/core/icons';
import { postPath, WELCOME_PATH } from '@/lib/routes/routePolicy';

const MENU_WIDTH = 288; // min(18rem, …) — fixed for positioning
const MENU_GAP = 4;

type MenuPos = { top: number; left: number; width: number };

function clampMenuPos(trigger: DOMRect): MenuPos {
  const width = Math.min(MENU_WIDTH, Math.max(200, window.innerWidth - 16));
  const left = Math.min(
    Math.max(8, trigger.right - width),
    window.innerWidth - width - 8,
  );
  const top = Math.min(trigger.bottom + MENU_GAP, window.innerHeight - 8);
  return { top, left, width };
}

function postShareUrl(postId: string): string {
  const path = postPath(postId);
  const origin = (
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/+$/, '');
  return origin ? `${origin}${path}` : path;
}

async function shareOrCopy(title: string, url: string): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch {
      /* fall through to copy */
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

export type PostOverflowMenuProps = {
  postId: string;
  accountId: string | null;
  /** When omitted, derived from signed-in account vs accountId. */
  isOwner?: boolean;
  archived?: boolean;
  isReported?: boolean;
  body?: string | null;
  /** Feed cards sit under a full-row Link — stop that navigation. */
  stopCardNav?: (e: MouseEvent) => void;
  /** Fires after a successful full compose edit. */
  onPostUpdated?: () => void;
  onArchived?: () => void;
  onRestored?: () => void;
  onDeleted?: () => void;
  onBlocked?: () => void;
  onReported?: () => void;
  className?: string;
  /** Smaller ⋯ trigger for single-line feed meta rows. */
  compact?: boolean;
};

/**
 * ⋯ menu for feed / post detail / profile timeline.
 * Owner: full edit (compose sheet), archive / restore / delete, share.
 * Others: share, report, block author.
 */
export function PostOverflowMenu({
  postId,
  accountId,
  isOwner: isOwnerProp,
  archived = false,
  isReported: isReportedProp = false,
  body = null,
  stopCardNav,
  onPostUpdated,
  onArchived,
  onRestored,
  onDeleted,
  onBlocked,
  onReported,
  className = '',
  compact = false,
}: PostOverflowMenuProps) {
  const router = useRouter();
  const { account } = useAuthSafe();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const isOwner =
    typeof isOwnerProp === 'boolean'
      ? isOwnerProp
      : Boolean(account?.id && accountId && account.id === accountId);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [reported, setReported] = useState(isReportedProp);

  const [archiveBusy, setArchiveBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [shareFlash, setShareFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setReported(isReportedProp);
  }, [isReportedProp, postId]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setConfirmDelete(false);
    setConfirmBlock(false);
    setError(null);
    setPos(null);
  }, []);

  const syncPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    setPos(clampMenuPos(el.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    syncPosition();
  }, [open, confirmDelete, confirmBlock, syncPosition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => closeMenu();
    const onResize = () => syncPosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, closeMenu, syncPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, closeMenu]);

  const guardAuth = () => {
    if (account) return true;
    closeMenu();
    router.push(`${WELCOME_PATH}?next=${encodeURIComponent(postPath(postId))}`);
    return false;
  };

  const onShare = async (e: MouseEvent) => {
    stopCardNav?.(e);
    const url = postShareUrl(postId);
    try {
      const mode = await shareOrCopy('Post · For the Love of Minnesota', url);
      setShareFlash(mode === 'shared' ? 'Shared' : 'Link copied');
      window.setTimeout(() => setShareFlash(null), 1600);
      closeMenu();
    } catch {
      setError('Could not share');
    }
  };

  const onArchive = async () => {
    if (!guardAuth() || archiveBusy) return;
    setArchiveBusy(true);
    setError(null);
    try {
      await archivePinPost(postId);
      closeMenu();
      onArchived?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not archive');
    } finally {
      setArchiveBusy(false);
    }
  };

  const onRestore = async () => {
    if (!guardAuth() || restoreBusy) return;
    setRestoreBusy(true);
    setError(null);
    try {
      await restorePinPost(postId);
      closeMenu();
      onRestored?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not restore');
    } finally {
      setRestoreBusy(false);
    }
  };

  const onPermanentDelete = async () => {
    if (!guardAuth() || deleteBusy) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await permanentlyDeletePinPost(postId);
      closeMenu();
      onDeleted?.();
      router.push('/feed');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const onBlock = async () => {
    if (!accountId || !guardAuth() || blockBusy) return;
    setBlockBusy(true);
    setError(null);
    try {
      await blockAccount(accountId);
      closeMenu();
      onBlocked?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not block user');
    } finally {
      setBlockBusy(false);
    }
  };

  const openEdit = (e: MouseEvent) => {
    stopCardNav?.(e);
    if (!guardAuth()) return;
    closeMenu();
    setComposeOpen(true);
  };

  const itemClass =
    'flex w-full items-center gap-3 px-3.5 py-3 text-left text-[15px] font-medium transition active:bg-black/[0.04] disabled:opacity-50';

  const menuPanel =
    open && mounted && pos
      ? createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed z-[200] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {error ? (
              <p className="border-b border-black/[0.06] px-3.5 py-2 text-[12px] text-red-600">
                {error}
              </p>
            ) : null}

            {isOwner ? (
              confirmDelete ? (
                <div className="px-3.5 py-3.5">
                  <p className="text-[14px] font-semibold text-foreground">
                    Delete this post permanently?
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-foreground-muted">
                    This can&apos;t be undone. Media and comments will be removed.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={deleteBusy}
                      onClick={(e) => {
                        stopCardNav?.(e);
                        setConfirmDelete(false);
                      }}
                      className="flex-1 rounded-xl bg-black/[0.05] py-2.5 text-[14px] font-medium text-foreground-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleteBusy}
                      onClick={(e) => {
                        stopCardNav?.(e);
                        void onPermanentDelete();
                      }}
                      className="flex-1 rounded-xl bg-red-600 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
                    >
                      {deleteBusy ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={openEdit}
                  >
                    <IconPencil className="h-5 w-5 text-foreground-muted" />
                    Edit
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={(e) => void onShare(e)}
                  >
                    <IconShare className="h-5 w-5 text-foreground-muted" />
                    Share
                  </button>
                  <div className="mx-3 h-px bg-black/[0.06]" />
                  {archived ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={restoreBusy}
                        className={itemClass}
                        onClick={(e) => {
                          stopCardNav?.(e);
                          void onRestore();
                        }}
                      >
                        {restoreBusy ? 'Restoring…' : 'Restore from archive'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={`${itemClass} text-red-600`}
                        onClick={(e) => {
                          stopCardNav?.(e);
                          setConfirmDelete(true);
                        }}
                      >
                        <IconTrash className="h-5 w-5" />
                        Delete permanently
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={archiveBusy}
                      className={`${itemClass} text-red-600`}
                      onClick={(e) => {
                        stopCardNav?.(e);
                        void onArchive();
                      }}
                    >
                      <IconTrash className="h-5 w-5" />
                      {archiveBusy ? 'Archiving…' : 'Archive'}
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-foreground-muted"
                    onClick={(e) => {
                      stopCardNav?.(e);
                      closeMenu();
                    }}
                  >
                    <IconX className="h-4 w-4" />
                    Cancel
                  </button>
                </>
              )
            ) : confirmBlock ? (
              <div className="px-3.5 py-3.5">
                <p className="text-[13px] leading-snug text-foreground-muted">
                  Hide this person&apos;s posts from your feed. You can unblock later from
                  their profile.
                </p>
                <button
                  type="button"
                  role="menuitem"
                  disabled={blockBusy || !accountId}
                  className={`${itemClass} mt-2 rounded-xl bg-red-50 text-red-600`}
                  onClick={(e) => {
                    stopCardNav?.(e);
                    void onBlock();
                  }}
                >
                  <IconShield className="h-5 w-5" />
                  {blockBusy ? 'Blocking…' : 'Block user'}
                </button>
                <button
                  type="button"
                  className="mt-1 flex w-full items-center justify-center py-2 text-[13px] font-medium text-foreground-muted"
                  onClick={(e) => {
                    stopCardNav?.(e);
                    setConfirmBlock(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={(e) => void onShare(e)}
                >
                  <IconShare className="h-5 w-5 text-foreground-muted" />
                  Share
                </button>
                {reported ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled
                    className={`${itemClass} text-foreground-muted opacity-70`}
                  >
                    <IconFlag className="h-5 w-5" />
                    Reported
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={(e) => {
                      stopCardNav?.(e);
                      if (!guardAuth()) return;
                      closeMenu();
                      setReportOpen(true);
                    }}
                  >
                    <IconFlag className="h-5 w-5 text-foreground-muted" />
                    Report
                  </button>
                )}
                {accountId ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${itemClass} text-red-600`}
                    onClick={(e) => {
                      stopCardNav?.(e);
                      if (!guardAuth()) return;
                      setConfirmBlock(true);
                    }}
                  >
                    <IconShield className="h-5 w-5" />
                    Block user
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center justify-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-foreground-muted"
                  onClick={(e) => {
                    stopCardNav?.(e);
                    closeMenu();
                  }}
                >
                  <IconX className="h-4 w-4" />
                  Cancel
                </button>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          stopCardNav?.(e);
          setOpen((v) => !v);
          setConfirmDelete(false);
          setConfirmBlock(false);
          setError(null);
        }}
        className={`pointer-events-auto relative z-[2] inline-flex items-center justify-center rounded-full text-foreground-muted transition active:scale-95 active:bg-black/[0.06] ${
          compact ? 'h-7 w-7' : 'h-8 w-8'
        }`}
      >
        <IconEllipsis className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>

      {shareFlash ? (
        <span className="pointer-events-none absolute -bottom-7 right-0 z-[3] whitespace-nowrap rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-white">
          {shareFlash}
        </span>
      ) : null}

      {menuPanel}

      {composeOpen ? (
        <CreatePostSheet
          state={{
            ...resolvePostLocationSeed(null),
            editPostId: postId,
          }}
          onClose={() => setComposeOpen(false)}
          onSaved={() => {
            onPostUpdated?.();
            setComposeOpen(false);
          }}
        />
      ) : null}

      <PostReportSheet
        open={reportOpen}
        postId={postId}
        alreadyReported={reported}
        onClose={() => setReportOpen(false)}
        onReported={() => {
          setReported(true);
          onReported?.();
        }}
      />
    </div>
  );
}
