'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useAuthSafe } from '@/features/auth';
import {
  fetchPinPostDetail,
  pinAuthorLabel,
  reportPinPost,
  type PinPostDetail,
} from '@/features/community/pinPostApi';
import {
  REPORT_REASON_OPTIONS,
  type ReportReason,
} from '@/features/community/reportReasons';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { ToolPrimaryButton } from '@/features/tools/core/toolUi';

/**
 * Report a community pin — opened from the post ⋯ menu.
 * Back returns to the same post (pin entity is kept in dock context).
 */
export default function ReportDockCard() {
  const { pinCardEntity, openDockCard, openAccount } = useMapDock();
  const { account } = useAuthSafe();
  const postId = pinCardEntity?.id ?? null;

  const [post, setPost] = useState<PinPostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const backToPost = () => openDockCard('pin');

  useEffect(() => {
    if (!postId) {
      setPost(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setDone(false);
    setReason(null);
    setDetails('');
    void fetchPinPostDetail(postId, ac.signal)
      .then((detail) => {
        setPost(detail);
        if (detail.is_reported) setDone(true);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setPost(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [postId]);

  const onSubmit = async () => {
    if (!postId || !reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reportPinPost(postId, reason, reason === 'other' ? details : undefined);
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not report');
    } finally {
      setBusy(false);
    }
  };

  if (!postId) {
    return (
      <DockCardShell
        variant="confirm"
        titleMode="sub"
        title="Report"
        backLabel="Post"
        onBack={backToPost}
      >
        <p className="px-0.5 text-center text-[13px] text-foreground-muted">
          This post is no longer available.
        </p>
      </DockCardShell>
    );
  }

  const author = post ? pinAuthorLabel(post.account) : pinCardEntity?.title ?? 'Post';
  const caption = (post?.body ?? pinCardEntity?.summary ?? '').trim();
  const alreadyReported = Boolean(post?.is_reported) || done;

  let body: ReactNode;
  if (!account) {
    body = (
      <div className="space-y-3 px-0.5 text-center">
        <p className="text-[14px] leading-snug text-foreground">
          Sign in to report this post.
        </p>
        <p className="text-[13px] text-foreground-muted">
          Reports help keep the community map useful for everyone.
        </p>
      </div>
    );
  } else if (alreadyReported) {
    body = (
      <div className="space-y-2 px-0.5 text-center">
        <p className="text-[15px] font-semibold text-foreground">Reported</p>
        <p className="text-[13px] leading-snug text-foreground-muted">
          Thanks — we&rsquo;ll review this post. You can&rsquo;t withdraw a report.
        </p>
      </div>
    );
  } else if (loading && !post) {
    body = (
      <p className="px-0.5 text-center text-[13px] text-foreground-muted">Loading…</p>
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="px-0.5 text-[13px] leading-snug text-foreground-muted">
          Why isn&rsquo;t this post good for the community?
        </p>
        <div
          className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          role="radiogroup"
          aria-label="Report reason"
        >
          {REPORT_REASON_OPTIONS.map((opt, i) => {
            const selected = reason === opt.id;
            return (
              <div key={opt.id}>
                {i > 0 ? <div className="mx-3 h-px bg-black/[0.06]" /> : null}
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setReason(opt.id)}
                  className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition active:bg-black/[0.04] ${
                    selected ? 'bg-lake-blue/[0.06]' : ''
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? 'border-lake-blue bg-lake-blue'
                        : 'border-black/20 bg-transparent'
                    }`}
                    aria-hidden
                  >
                    {selected ? (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-foreground">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-foreground-muted">
                      {opt.hint}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        {reason === 'other' ? (
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            placeholder="Tell us what’s wrong (optional)"
            className="w-full resize-none rounded-2xl border border-black/[0.08] bg-[#F2F2F7] px-3.5 py-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-foreground-muted focus:border-lake-blue/50 focus:ring-2 focus:ring-lake-blue/20"
          />
        ) : null}
        {error ? (
          <p className="px-0.5 text-center text-[12px] text-red-600">{error}</p>
        ) : null}
      </div>
    );
  }

  const footer = !account ? (
    <div className="space-y-2">
      <ToolPrimaryButton onClick={openAccount}>Sign in</ToolPrimaryButton>
      <ToolPrimaryButton variant="secondary" onClick={backToPost}>
        Back to post
      </ToolPrimaryButton>
    </div>
  ) : alreadyReported ? (
    <ToolPrimaryButton variant="secondary" onClick={backToPost}>
      Back to post
    </ToolPrimaryButton>
  ) : (
    <div className="space-y-2">
      <ToolPrimaryButton
        loading={busy}
        disabled={busy || !reason || loading}
        onClick={() => void onSubmit()}
      >
        Submit report
      </ToolPrimaryButton>
      <ToolPrimaryButton variant="secondary" disabled={busy} onClick={backToPost}>
        Cancel
      </ToolPrimaryButton>
    </div>
  );

  return (
    <DockCardShell
      variant="confirm"
      titleMode="sub"
      title="Report"
      backLabel="Post"
      onBack={backToPost}
      footer={footer}
      scrollKey={postId}
    >
      {/* Clear link to the post being reported */}
      <button
        type="button"
        onClick={backToPost}
        className={`mb-3 w-full rounded-2xl px-3.5 py-3 text-left transition active:opacity-80 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          Reporting
        </p>
        <p className="mt-1 truncate text-[15px] font-semibold text-foreground">{author}</p>
        {caption ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-foreground-muted">
            {caption}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-foreground-muted">Tap to return to this post</p>
        )}
      </button>
      {body}
    </DockCardShell>
  );
}
