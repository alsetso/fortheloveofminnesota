'use client';

import type { ReactNode } from 'react';
import { Post } from '@/types/post';
import Link from 'next/link';
import { GlobeAltIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import MentionCard from './MentionCard';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { MultiImageGrid } from '@/components/shared/MultiImageGrid';
import { Account } from '@/features/auth';

function DetailBlock({
  children,
  href,
  className = '',
  ariaLabel,
  title,
}: {
  children: ReactNode;
  href?: string;
  className?: string;
  ariaLabel?: string;
  title?: string;
}) {
  const base =
    'block bg-gray-50 border border-gray-200 rounded-md p-[10px] hover:bg-gray-100 transition-colors';

  if (href) {
    return (
      <Link href={href} className={`${base} ${className}`} aria-label={ariaLabel} title={title}>
        {children}
      </Link>
    );
  }

  return <div className={`bg-gray-50 border border-gray-200 rounded-md p-[10px] ${className}`}>{children}</div>;
}

interface FeedPostProps {
  post: Post;
  variant?: 'card' | 'timeline';
  isFirst?: boolean;
  isLast?: boolean;
}

export default function FeedPost({
  post,
  variant = 'card',
  isFirst = false,
  isLast = false,
}: FeedPostProps) {
  const username = post.account?.username || 'unknown';
  const displayName = post.account?.username || 'Unknown User';

  const timeAgo = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: post.created_at > new Date(Date.now() - 86400000).toISOString() ? undefined : 'numeric',
  });

  if (variant === 'timeline') {
    return (
      <article className="relative flex gap-2 py-2">
        {/* Vertical connector line (between avatars) */}
        {!isFirst && <div aria-hidden="true" className="absolute left-4 top-0 h-6 w-px bg-gray-200" />}
        {!isLast && <div aria-hidden="true" className="absolute left-4 top-6 bottom-0 w-px bg-gray-200" />}

        {/* Left rail: avatar */}
        <div className="relative z-10 w-10 flex-shrink-0">
          <Link
            href={`/profile/${username}`}
            className="block w-8 hover:opacity-80 transition-opacity"
            aria-label={`View profile: ${displayName}`}
          >
            <ProfilePhoto account={post.account as unknown as Account} size="sm" editable={false} />
          </Link>
        </div>

        {/* Right rail: header + content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/profile/${username}`}
                className="text-sm font-semibold text-gray-900 truncate hover:text-gray-900"
                title={`@${displayName}`}
              >
                @{displayName}
              </Link>
              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                {post.mention_type && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-600"
                    title={post.mention_type.name}
                  >
                    <span aria-hidden="true">{post.mention_type.emoji}</span>
                    <span className="truncate">{post.mention_type.name}</span>
                  </span>
                )}
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-500 whitespace-nowrap">{timeAgo}</span>
                {post.visibility && (
                  <>
                    <span className="text-xs text-gray-500">•</span>
                    {post.visibility === 'public' ? (
                      <GlobeAltIcon className="w-3 h-3 text-gray-500" title="Public" />
                    ) : (
                      <LockClosedIcon className="w-3 h-3 text-gray-500" title="Draft" />
                    )}
                  </>
                )}
              </div>
            </div>

            <Link
              href={`/post/${post.id}`}
              className="w-7 h-7 rounded-md hover:bg-gray-50 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="View post"
              title="View post"
            >
              <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </Link>
          </div>

          <div className="mt-1 space-y-2">
            {post.title && <h3 className="text-sm font-semibold text-gray-900">{post.title}</h3>}

            <div className="text-xs text-gray-900 whitespace-pre-wrap">{post.content}</div>

            {post.images && post.images.length > 0 && (
              <MultiImageGrid images={post.images ?? []} postHref={`/post/${post.id}`} />
            )}

            {post.map_data && (
              <DetailBlock
                href={`/map?lat=${post.map_data.lat}&lng=${post.map_data.lng}&zoom=15`}
                ariaLabel="View location on map"
                title="View location on map"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {post.map_data.place_name || post.map_data.address || 'Location'}
                    </div>
                    {post.map_data.address && post.map_data.place_name && (
                      <div className="text-xs text-gray-500 truncate">{post.map_data.address}</div>
                    )}
                  </div>
                </div>
              </DetailBlock>
            )}

            {post.mentions && post.mentions.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-gray-600">Referenced Places</div>
                <div className="grid grid-cols-1 gap-2">
                  {post.mentions.map((mention) => (
                    <MentionCard key={mention.id} mention={mention} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="bg-white border border-gray-200 rounded-md p-[10px]">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-4">
        {/* Left: Avatar, Username, Timestamp - All Clickable */}
        <Link
          href={`/profile/${username}`}
          className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
        >
          {/* Avatar */}
          <div className="flex-shrink-0">
            <ProfilePhoto account={post.account as unknown as Account} size="sm" editable={false} />
          </div>

          {/* Username and Timestamp */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-gray-900">@{displayName}</span>
            {post.mention_type && (
              <>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-600" title={post.mention_type.name}>
                  {post.mention_type.emoji} {post.mention_type.name}
                </span>
              </>
            )}
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">{timeAgo}</span>
            {post.visibility && (
              <>
                <span className="text-xs text-gray-500">•</span>
                {post.visibility === 'public' ? (
                  <GlobeAltIcon className="w-3.5 h-3.5 text-gray-500" title="Public" />
                ) : (
                  <LockClosedIcon className="w-3.5 h-3.5 text-gray-500" title="Draft" />
                )}
              </>
            )}
          </div>
        </Link>

        {/* Right: Three Dots Menu */}
        <Link
          href={`/post/${post.id}`}
          className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0"
          aria-label="View post"
        >
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </Link>
      </div>

      {/* Title (if exists) */}
      {post.title && <h3 className="text-lg font-semibold text-gray-900 mb-2">{post.title}</h3>}

      {/* Content */}
      <div className="text-sm text-gray-900 whitespace-pre-wrap mb-4">{post.content}</div>

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <div className="mb-4">
          <MultiImageGrid images={post.images ?? []} postHref={`/post/${post.id}`} />
        </div>
      )}

      {/* Map Data / Location */}
      {post.map_data && (
        <div className="mb-4">
          <Link
            href={`/map?lat=${post.map_data.lat}&lng=${post.map_data.lng}&zoom=15`}
            className="block bg-gray-50 border border-gray-200 rounded-md p-[10px] hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {post.map_data.place_name || post.map_data.address || 'Location'}
                </div>
                {post.map_data.address && post.map_data.place_name && (
                  <div className="text-xs text-gray-500">{post.map_data.address}</div>
                )}
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Mentions */}
      {post.mentions && post.mentions.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="text-xs font-medium text-gray-600 mb-2">Referenced Places:</div>
          <div className="grid grid-cols-1 gap-2">
            {post.mentions.map((mention) => (
              <MentionCard key={mention.id} mention={mention} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

