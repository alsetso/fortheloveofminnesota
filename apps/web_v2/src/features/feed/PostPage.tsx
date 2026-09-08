'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { PageScroll } from '@/features/appShell/PageScroll';
import {
  createPinPostComment,
  fetchPinPostComments,
  fetchPinPostDetail,
  formatCompactTime,
  formatPinCount,
  pinAuthorLabel,
  recordPinPostView,
  togglePinPostLike,
  type PinPostComment,
  type PinPostDetail,
} from '@/features/community/pinPostApi';
import { feedAuthorProfilePath } from '@/features/community/profileApi';
import { PinPostMediaBlock } from '@/features/community/PinPostMediaBlock';
import { PostLightboxActions } from '@/features/community/PostLightboxActions';
import { PostOverflowMenu } from '@/features/community/PostOverflowMenu';
import { PostPlaceLine } from '@/features/feed/PostPlaceLine';
import { PostSeeOnMapPopover } from '@/features/feed/PostSeeOnMapPopover';
import { IconArrowLeft, IconChat, IconHeart } from '@/features/map/dockCore/core/icons';
import { FEED_PATH } from '@/lib/routes/routePolicy';
import { safePadTop } from '@/lib/despia/safeArea';

/** Primary author label — username preferred (profile link target). */
function authorLabel(post: PinPostDetail): string {
  return pinAuthorLabel(post.account) || 'Minnesota Resident';
}

function authorInitials(post: PinPostDetail): string {
  const name = pinAuthorLabel(post.account);
  return (name.replace(/^@/, '').trim().slice(0, 1) || 'M').toUpperCase();
}

function commentInitials(c: PinPostComment): string {
  return (pinAuthorLabel(c.author).replace(/^@/, '').slice(0, 1) || 'M').toUpperCase();
}

/** Full post — Own scroll surface pushed from Feed. */
export default function PostPage({ postId }: { postId: string }) {
  const router = useRouter();
  const { account } = useAuthSafe();
  const [post, setPost] = useState<PinPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  const [comments, setComments] = useState<PinPostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setPost(null);
    void fetchPinPostDetail(postId, ac.signal)
      .then((p) => {
        setPost(p);
        setLiked(p.is_liked);
        setLikeCount(p.like_count);
        setCommentCount(p.comment_count);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load post');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [postId]);

  useEffect(() => {
    if (viewedRef.current === postId) return;
    viewedRef.current = postId;
    void recordPinPostView(postId);
  }, [postId]);

  useEffect(() => {
    const ac = new AbortController();
    setCommentsLoading(true);
    void fetchPinPostComments(postId, ac.signal)
      .then((rows) => {
        if (!ac.signal.aborted) setComments(rows);
      })
      .finally(() => {
        if (!ac.signal.aborted) setCommentsLoading(false);
      });
    return () => ac.abort();
  }, [postId]);

  const onLike = useCallback(async () => {
    if (!post || !account || likeBusy || post.archived) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    setLikeBusy(true);
    try {
      const res = await togglePinPostLike(post.id, next);
      setLiked(res.reacted);
      setLikeCount(res.like_count);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    } finally {
      setLikeBusy(false);
    }
  }, [account, likeBusy, liked, post]);

  const onComment = useCallback(async () => {
    if (!post || !account || commentBusy) return;
    const text = draft.trim();
    if (!text) return;
    setCommentBusy(true);
    try {
      const res = await createPinPostComment(post.id, text);
      setDraft('');
      setComments((prev) => [res.comment, ...prev]);
      if (typeof res.comment_count === 'number') setCommentCount(res.comment_count);
      else setCommentCount((c) => c + 1);
    } catch {
      /* keep draft */
    } finally {
      setCommentBusy(false);
    }
  }, [account, commentBusy, draft, post]);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(FEED_PATH);
  };

  const name = post ? authorLabel(post) : '';
  const placeLabel = post?.place_label?.trim() || null;
  const hasPlaceLine = Boolean(
    placeLabel || post?.city_name || post?.zip_code,
  );
  const body = post?.body?.trim() || null;
  const profileHref = post ? feedAuthorProfilePath(post.account, post.account_id) : null;
  const hasMapFocus =
    typeof post?.lat === 'number' &&
    typeof post?.lng === 'number' &&
    Number.isFinite(post.lat) &&
    Number.isFinite(post.lng);

  const authorAvatar = post ? (
    post.account?.image_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.account.image_url}
        alt=""
        className="h-full w-full object-cover"
      />
    ) : post.emoji?.trim() ? (
      <div className="flex h-full w-full items-center justify-center text-base">
        {post.emoji}
      </div>
    ) : (
      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-foreground">
        {authorInitials(post)}
      </div>
    )
  ) : null;

  const viewerInitial = (
    account?.first_name?.trim()?.[0] ||
    account?.username?.trim()?.[0] ||
    account?.email?.trim()?.[0] ||
    'M'
  ).toUpperCase();

  return (
    <PageScroll>
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
        style={{ paddingTop: safePadTop('0.2rem') }}
      >
        <div className="relative flex h-11 items-center px-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back to Feed"
            className="relative z-[1] inline-flex h-9 items-center gap-0.5 rounded-full px-1.5 text-lake-blue transition active:opacity-70"
          >
            <IconArrowLeft className="h-5 w-5" />
            <span className="text-[16px] font-semibold">Feed</span>
          </button>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-bold tracking-tight text-foreground">
            Post
          </h1>
          <div className="ml-auto w-[72px]" aria-hidden />
        </div>
      </header>

      <div className="pb-24">
        {loading ? (
          <div className="animate-pulse space-y-3 px-4 py-4">
            <div className="flex gap-2.5">
              <div className="h-10 w-10 shrink-0 rounded-full bg-black/[0.06]" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-40 rounded bg-black/[0.06]" />
                <div className="h-3 w-full rounded bg-black/[0.06]" />
                <div className="h-3 w-4/5 rounded bg-black/[0.06]" />
              </div>
            </div>
          </div>
        ) : error || !post ? (
          <div className="px-5 py-14 text-center">
            <p className="text-[17px] font-bold tracking-tight text-foreground">
              {error ?? 'Post not found'}
            </p>
            <button
              type="button"
              onClick={goBack}
              className="mt-4 text-[14px] font-semibold text-lake-blue transition active:opacity-70"
            >
              Back to Feed
            </button>
          </div>
        ) : (
          <>
            <article className="px-4 py-3">
              <div className="flex gap-2.5">
                {profileHref ? (
                  <Link
                    href={profileHref}
                    aria-label={`Open profile ${name}`}
                    className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-black/10 bg-lake-blue/15 transition active:opacity-80"
                  >
                    {authorAvatar}
                  </Link>
                ) : (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-black/10 bg-lake-blue/15">
                    {authorAvatar}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden pr-0.5">
                      {profileHref ? (
                        <Link
                          href={profileHref}
                          className="min-w-0 shrink truncate text-[15px] font-semibold leading-none tracking-tight text-foreground transition active:opacity-70"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="min-w-0 shrink truncate text-[15px] font-semibold leading-none tracking-tight text-foreground">
                          {name}
                        </span>
                      )}
                      <span
                        className="shrink-0 text-[13px] leading-none text-foreground-muted"
                        aria-hidden
                      >
                        ·
                      </span>
                      <time
                        dateTime={post.created_at}
                        className="shrink-0 text-[13px] leading-none tabular-nums text-foreground-muted"
                      >
                        {formatCompactTime(post.created_at)}
                      </time>
                    </div>
                    <PostOverflowMenu
                      compact
                      postId={post.id}
                      accountId={post.account_id}
                      isOwner={post.is_owner}
                      archived={Boolean(post.archived)}
                      isReported={post.is_reported}
                      body={post.body}
                      onPostUpdated={() => {
                        void fetchPinPostDetail(post.id).then((p) => {
                          setPost(p);
                          setLiked(p.is_liked);
                          setLikeCount(p.like_count);
                          setCommentCount(p.comment_count);
                        });
                      }}
                      onArchived={() => {
                        setPost((p) => (p ? { ...p, archived: true } : p));
                        router.push(FEED_PATH);
                      }}
                      onRestored={() =>
                        setPost((p) => (p ? { ...p, archived: false } : p))
                      }
                      onDeleted={() => router.push(FEED_PATH)}
                      onBlocked={() => router.push(FEED_PATH)}
                      onReported={() =>
                        setPost((p) => (p ? { ...p, is_reported: true } : p))
                      }
                    />
                  </div>

                  {body ? (
                    <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug text-foreground">
                      {body}
                    </p>
                  ) : null}

                  <PinPostMediaBlock
                    media={post.media}
                    lightboxAuthor={{
                      name: name,
                      imageUrl: post.account?.image_url,
                      fallback: post.emoji?.trim() || authorInitials(post),
                    }}
                    lightboxFooter={({ close }) => (
                      <PostLightboxActions
                        liked={liked}
                        likeCount={likeCount}
                        commentCount={commentCount}
                        likeDisabled={likeBusy || !account || Boolean(post.archived)}
                        onLike={() => void onLike()}
                        onComment={() => {
                          close();
                          window.setTimeout(() => {
                            inputRef.current?.focus();
                            document
                              .getElementById('post-comment-composer')
                              ?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                          }, 50);
                        }}
                      />
                    )}
                  />

                  {hasPlaceLine || hasMapFocus ? (
                    <PostPlaceLine
                      cityName={post.city_name ?? null}
                      zipCode={post.zip_code ?? null}
                      unitId={post.unit_id ?? null}
                      zipcodeId={post.zipcode_id ?? null}
                      trailing={
                        hasMapFocus ? (
                          <PostSeeOnMapPopover
                            lat={post.lat as number}
                            lng={post.lng as number}
                          />
                        ) : null
                      }
                    />
                  ) : null}

                  <div className="mt-3 flex items-center gap-5 text-[13px] text-foreground-muted">
                    <button
                      type="button"
                      onClick={() => void onLike()}
                      disabled={likeBusy || !account || Boolean(post.archived)}
                      aria-pressed={liked}
                      aria-label={liked ? 'Unlike' : 'Like'}
                      className={`inline-flex items-center gap-1.5 transition active:opacity-70 disabled:opacity-40 ${
                        liked ? 'text-red-500' : ''
                      }`}
                    >
                      <IconHeart className="h-4 w-4" solid={liked} />
                      {formatPinCount(likeCount)}
                    </button>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.focus()}
                      aria-label="Comment"
                      className="inline-flex items-center gap-1.5 transition active:opacity-70"
                    >
                      <IconChat className="h-4 w-4" />
                      {formatPinCount(commentCount)}
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <section id="post-comments" className="border-t border-black/[0.08] px-4 py-3">
              <div className="space-y-3.5">
                {commentsLoading && comments.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-foreground-muted">
                    Loading comments…
                  </p>
                ) : comments.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-foreground-muted">
                    No comments yet
                  </p>
                ) : (
                  comments.map((c) => {
                    const commentProfile = feedAuthorProfilePath(
                      c.author,
                      c.author?.id,
                    );
                    return (
                      <div key={c.id} className="flex gap-2.5">
                        {commentProfile ? (
                          <Link
                            href={commentProfile}
                            className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-black/10 bg-lake-blue/15 transition active:opacity-80"
                          >
                            {c.author?.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.author.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground">
                                {commentInitials(c)}
                              </div>
                            )}
                          </Link>
                        ) : (
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-black/10 bg-lake-blue/15">
                            {c.author?.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.author.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground">
                                {commentInitials(c)}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            {commentProfile ? (
                              <Link
                                href={commentProfile}
                                className="truncate text-[13px] font-semibold text-foreground transition active:opacity-70"
                              >
                                {pinAuthorLabel(c.author)}
                              </Link>
                            ) : (
                              <span className="truncate text-[13px] font-semibold text-foreground">
                                {pinAuthorLabel(c.author)}
                              </span>
                            )}
                            <span className="shrink-0 text-[12px] text-foreground-muted">
                              {formatCompactTime(c.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-snug text-foreground">
                            {c.body}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {account && post && !post.archived ? (
        <div
          id="post-comment-composer"
          className="sticky bottom-0 z-10 border-t border-black/[0.08] bg-[#f7f5f1]/95 px-3 py-2 backdrop-blur-sm"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-black/10 bg-lake-blue/15">
              {account.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={account.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground">
                  {viewerInitial}
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onComment();
                }
              }}
              placeholder="Add a comment…"
              maxLength={500}
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-foreground-muted/70"
            />
            {draft.trim() ? (
              <button
                type="button"
                onClick={() => void onComment()}
                disabled={commentBusy}
                className="shrink-0 px-1.5 text-[14px] font-semibold text-lake-blue transition active:opacity-70 disabled:opacity-40"
              >
                Post
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageScroll>
  );
}
