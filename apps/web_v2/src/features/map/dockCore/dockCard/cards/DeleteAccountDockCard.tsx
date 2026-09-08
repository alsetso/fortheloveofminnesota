'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccountHandle, useAuthSafe } from '@/features/auth';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { normalizeUsernameConfirm } from '@/lib/account/accountDeletePreview';
import { SETUP_PATH, WELCOME_PATH } from '@/lib/routes/routePolicy';

type DeletePreview = {
  username: string | null;
  postCount: number;
  pinCount: number;
  followersCount: number;
  followingCount: number;
  pageCount: number;
  collectionCount: number;
};

/**
 * Permanent account deletion — Apple 5.1.1(v).
 * Confirms with @username, then POST /api/account/delete.
 */
export default function DeleteAccountDockCard() {
  const router = useRouter();
  const { openAccount, openDockCard, closeDockCard, collapse } = useMapDock();
  const {
    account,
    signOut,
    clearAccountSelection,
    selectAccount,
  } = useAuthSafe();

  const handle = getAccountHandle(account);
  const expected = account?.username
    ? normalizeUsernameConfirm(account.username)
    : '';

  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmInput, setConfirmInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const confirmMatches =
    Boolean(expected) && normalizeUsernameConfirm(confirmInput) === expected;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const res = await fetch('/api/account/delete-preview', {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? 'Could not load account summary');
        }
        const json = (await res.json()) as { preview: DeletePreview };
        if (!cancelled) setPreview(json.preview);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Could not load account summary',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onDelete = async () => {
    if (!confirmMatches || submitting || !account) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: confirmInput.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? 'Delete failed');
      }
      const body = (await res.json()) as {
        remainingAccountCount?: number;
        suggestedNextAccountId?: string | null;
        authUserRemoved?: boolean;
      };

      closeDockCard();
      collapse();

      if (body.authUserRemoved || (body.remainingAccountCount ?? 0) <= 0) {
        clearAccountSelection();
        await signOut();
        router.replace(WELCOME_PATH);
        router.refresh();
        return;
      }

      if (body.suggestedNextAccountId) {
        selectAccount(body.suggestedNextAccountId);
        router.replace(SETUP_PATH);
        router.refresh();
        return;
      }

      clearAccountSelection();
      await signOut();
      router.replace(WELCOME_PATH);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DockCardShell
      variant="confirm"
      titleMode="sub"
      eyebrow="Danger zone"
      title="Delete account"
      subtitle="This cannot be undone"
      backLabel="Account"
      onBack={() => openAccount()}
    >
      <div
        className={`rounded-2xl px-4 py-3 text-[13px] leading-snug text-foreground-muted ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        Deleting permanently removes your profile, posts, pins, collections, and
        account data. Temporary deactivate is not offered.
      </div>

      {loading ? (
        <p className="text-[13px] text-foreground-muted">Loading summary…</p>
      ) : loadError ? (
        <p className="text-[13px] text-red-600">{loadError}</p>
      ) : preview ? (
        <ul className="space-y-1 text-[13px] text-foreground-muted">
          <li>
            Posts / pins:{' '}
            <span className="font-semibold text-foreground">
              {preview.postCount + preview.pinCount}
            </span>
          </li>
          <li>
            Followers / following:{' '}
            <span className="font-semibold text-foreground">
              {preview.followersCount} / {preview.followingCount}
            </span>
          </li>
          <li>
            Pages:{' '}
            <span className="font-semibold text-foreground">{preview.pageCount}</span>
          </li>
          <li>
            Collections:{' '}
            <span className="font-semibold text-foreground">
              {preview.collectionCount}
            </span>
          </li>
        </ul>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-[12px] font-medium text-foreground-muted">
          Type {handle || '@username'} to confirm
        </span>
        <input
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={confirmInput}
          disabled={submitting || !expected}
          onChange={(e) => setConfirmInput(e.target.value)}
          placeholder={handle || '@username'}
          className={`w-full rounded-2xl px-3.5 py-3 text-[15px] text-foreground outline-none ring-1 ring-inset ring-black/10 focus:ring-lake-blue/40 disabled:opacity-50 ${MAP_DOCK_GLASS_FILL_CLASS}`}
        />
      </label>

      {submitError ? (
        <p className="text-[13px] text-red-600">{submitError}</p>
      ) : null}

      <button
        type="button"
        disabled={!confirmMatches || submitting}
        onClick={() => void onDelete()}
        className="w-full rounded-2xl bg-red-600 py-3.5 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-45"
      >
        {submitting ? 'Deleting…' : 'Delete permanently'}
      </button>
    </DockCardShell>
  );
}
