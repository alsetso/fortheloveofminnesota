'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPinIcon, LinkIcon, PencilIcon, TrashIcon, EllipsisVerticalIcon,
  ShareIcon, CheckIcon, CalendarIcon,
  UserGroupIcon, ClipboardDocumentIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { MentionService } from '../services/mentionService';
import { useRouter } from 'next/navigation';
import { usePageView } from '@/hooks/usePageView';
import { getMapUrlWithPin } from '@/lib/maps/urls';
import { type MultiImage } from '@/components/shared/MultiImageGrid';
import ImageOverlay from './ImageOverlay';
import { mentionTypeNameToSlug } from '../utils/mentionTypeHelpers';

interface MentionDetailClientProps {
  mention: {
    id: string;
    lat: number;
    lng: number;
    description: string | null;
    visibility: 'public' | 'only_me';
    image_url: string | null;
    video_url: string | null;
    media_type: 'image' | 'video' | 'none' | null;
    full_address: string | null;
    view_count?: number | null;
    pin_view_count?: number;
    page_view_count?: number;
    created_at: string;
    updated_at: string;
    post_date?: string | null;
    map_meta?: Record<string, any> | null;
    tagged_accounts?: { id: string; username: string | null }[] | null;
    account_id: string | null;
    accounts?: {
      id: string;
      username: string | null;
      first_name: string | null;
      image_url: string | null;
      account_taggable?: boolean | null;
    } | null;
    mention_type?: {
      id: string;
      emoji: string;
      name: string;
    } | null;
    collection?: {
      id: string;
      emoji: string;
      title: string;
    } | null;
    map?: { id: string; name?: string | null; slug: string | null } | null;
  };
  isOwner: boolean;
}

function getViewOnMapHref(mention: MentionDetailClientProps['mention']): string {
  if (mention.map?.slug === 'live') return `/maps?pin=${encodeURIComponent(mention.id)}`;
  if (mention.map && Number.isFinite(mention.lat) && Number.isFinite(mention.lng)) {
    return getMapUrlWithPin({ id: mention.map.id, slug: mention.map.slug ?? null }, mention.lat, mention.lng);
  }
  return `/maps?pin=${encodeURIComponent(mention.id)}`;
}

function relativeTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  const days = Math.floor(sec / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(Date.now() - ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export default function MentionDetailClient({ mention, isOwner }: MentionDetailClientProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const pinViews = mention.pin_view_count ?? mention.view_count ?? 0;
  const pageViews = mention.page_view_count ?? 0;

  usePageView({ page_url: `/mention/${mention.id}` });

  const accountName = mention.accounts?.first_name || mention.accounts?.username || 'Anonymous';
  const placeName = mention.map_meta?.place_name || mention.map_meta?.name || null;
  const coordinates = Number.isFinite(mention.lat) && Number.isFinite(mention.lng)
    ? `${mention.lat.toFixed(6)}, ${mention.lng.toFixed(6)}`
    : null;

  const createdMs = new Date(mention.created_at).getTime();
  const updatedMs = new Date(mention.updated_at).getTime();
  const wasEdited = updatedMs > createdMs;

  // Defer Date.now()-dependent values to client to avoid hydration mismatch
  const [editedLabel, setEditedLabel] = useState<string | null>(null);
  useEffect(() => {
    if (wasEdited) setEditedLabel(relativeTime(Date.now() - updatedMs));
  }, [wasEdited, updatedMs]);

  const eventDate = mention.post_date ? shortDate(mention.post_date) : null;
  const showEventDate = eventDate && eventDate !== shortDate(mention.created_at);

  // Media
  const images: MultiImage[] = [];
  if (mention.media_type !== 'video' && mention.image_url) {
    images.push({ url: mention.image_url, alt: mention.description ?? undefined });
  }

  // Handlers
  const handleCopyCoordinates = async () => {
    if (!coordinates) return;
    try {
      await navigator.clipboard.writeText(coordinates);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  const [shareUrl, setShareUrl] = useState('');
  useEffect(() => {
    setShareUrl(`${window.location.origin}/mention/${mention.id}`);
  }, [mention.id]);

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      setShowMenu(false);
    } catch {}
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    const shareData = {
      title: 'Check out this mention on Love of Minnesota',
      text: mention.description || 'Check out this mention on the map!',
      url: shareUrl,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        handleCopyLink();
      }
    } catch {}
    setShowMenu(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this mention?')) {
      setShowMenu(false);
      return;
    }
    setIsDeleting(true);
    try {
      await MentionService.deleteMention(mention.id);
      router.push('/');
    } catch {
      alert('Failed to delete mention');
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  return (
    <>
      <article className="space-y-3">
        {/* ── Card: Author + Actions ── */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <Link href={mention.accounts?.username ? `/${mention.accounts.username}` : '#'} className="flex-shrink-0">
              {mention.accounts?.image_url ? (
                <Image
                  src={mention.accounts.image_url}
                  alt={accountName}
                  width={28}
                  height={28}
                  className="w-7 h-7 rounded-full object-cover"
                  unoptimized={mention.accounts.image_url.includes('supabase.co')}
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-500">
                  {accountName.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>

            {/* Name + timestamp */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  href={mention.accounts?.username ? `/${mention.accounts.username}` : '#'}
                  className="text-xs font-semibold text-gray-900 truncate hover:text-gray-700 transition-colors"
                >
                  {accountName}
                </Link>
                <span className="text-[10px] text-gray-400">&middot;</span>
                <span className="text-[10px] text-gray-500 flex-shrink-0">{shortDate(mention.created_at)}</span>
                {wasEdited && (
                  <>
                    <span className="text-[10px] text-gray-400">&middot;</span>
                    <span className="text-[10px] text-gray-400 italic flex-shrink-0">edited {editedLabel}</span>
                  </>
                )}
              </div>
              {mention.accounts?.username && (
                <Link
                  href={`/${mention.accounts.username}`}
                  className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
                >
                  @{mention.accounts.username}
                </Link>
              )}
            </div>

            {/* Type badge */}
            {mention.mention_type && (
              <Link
                href={`/maps?type=${encodeURIComponent(mentionTypeNameToSlug(mention.mention_type.name))}`}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <span className="text-xs">{mention.mention_type.emoji}</span>
                <span className="text-[10px] font-medium text-gray-600">{mention.mention_type.name}</span>
              </Link>
            )}

            {/* Collection badge */}
            {mention.collection && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 flex-shrink-0">
                <span className="text-xs">{mention.collection.emoji}</span>
                <span className="text-[10px] font-medium text-blue-700">{mention.collection.title}</span>
              </div>
            )}

            {/* Menu */}
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-0.5 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="More options"
              >
                <EllipsisVerticalIcon className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 rounded-md shadow-lg z-20 min-w-[140px] bg-white border border-gray-200 py-0.5">
                  <button onClick={handleCopyLink} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                    {isCopied ? <><CheckIcon className="w-3 h-3 text-green-600" /><span className="text-green-600">Copied!</span></> : <><ClipboardDocumentIcon className="w-3 h-3" /><span>Copy URL</span></>}
                  </button>
                  <button onClick={handleShare} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                    <ShareIcon className="w-3 h-3" /><span>Share</span>
                  </button>
                  {mention.accounts?.username && (
                    <Link href={`/${mention.accounts.username}?mentionId=${mention.id}`} onClick={() => setShowMenu(false)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                      <MapPinIcon className="w-3 h-3" /><span>View on Profile</span>
                    </Link>
                  )}
                  {isOwner && (
                    <>
                      <div className="border-t border-gray-200 my-0.5" />
                      <Link href={`/mention/${mention.id}/edit`} onClick={() => setShowMenu(false)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                        <PencilIcon className="w-3 h-3" /><span>Edit</span>
                      </Link>
                      <button onClick={handleDelete} disabled={isDeleting} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <TrashIcon className="w-3 h-3" /><span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Card: Content (media + description) ── */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          {/* Video */}
          {mention.media_type === 'video' && mention.video_url && (
            <div className="bg-black">
              <video
                src={mention.video_url}
                controls
                playsInline
                muted
                preload="metadata"
                className="w-full h-auto max-h-[400px] object-contain"
              />
            </div>
          )}

          {/* Image */}
          {images.length > 0 && (
            <button
              onClick={() => setSelectedImageIndex(0)}
              className="block w-full aspect-[4/3] bg-gray-100 hover:opacity-95 transition-opacity cursor-pointer"
              aria-label="View full image"
            >
              <img src={images[0].url} alt={images[0].alt || 'Pin image'} className="w-full h-full object-cover" />
            </button>
          )}

          {/* Description */}
          {mention.description && (
            <div className="p-[10px]">
              <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">{mention.description}</p>
            </div>
          )}

          {/* Event date */}
          {showEventDate && (
            <div className="px-[10px] pb-[10px] flex items-center gap-1.5 text-[10px] text-gray-500">
              <CalendarIcon className="w-3 h-3" />
              <span>Event: {eventDate}</span>
            </div>
          )}
        </div>

        {/* ── Card: Location ── */}
        {(mention.full_address || placeName || coordinates) && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
            {placeName && (
              <div className="flex items-center gap-1.5 text-xs text-gray-900 font-medium">
                <MapPinIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <span>{placeName}</span>
              </div>
            )}
            {mention.full_address && (
              <div className="flex items-start gap-1.5 text-[10px] text-gray-600">
                <MapPinIcon className="w-3 h-3 text-gray-400 flex-shrink-0 mt-px" />
                <span>{mention.full_address}</span>
              </div>
            )}
            {coordinates && (
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <MapPinIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <button
                  onClick={handleCopyCoordinates}
                  className="flex items-center gap-1 font-mono hover:text-gray-900 transition-colors"
                  title="Copy coordinates"
                >
                  {coordinates}
                  {isCopied ? <CheckIcon className="w-2.5 h-2.5 text-green-600" /> : <ClipboardDocumentIcon className="w-2.5 h-2.5 text-gray-400" />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Card: Tagged accounts ── */}
        {mention.tagged_accounts && mention.tagged_accounts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600 flex-wrap">
              <UserGroupIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
              {mention.tagged_accounts.map((tagged, idx) => (
                <span key={tagged.id}>
                  {tagged.username ? (
                    <Link href={`/${encodeURIComponent(tagged.username)}`} className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
                      @{tagged.username}
                    </Link>
                  ) : (
                    <span className="text-gray-400">Unknown</span>
                  )}
                  {idx < mention.tagged_accounts!.length - 1 && <span className="text-gray-300">, </span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Card: Stats + CTA ── */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          {/* Stats row */}
          <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-2">
            <span className="flex items-center gap-1"><MapPinIcon className="w-3 h-3" />{pinViews} map {pinViews === 1 ? 'view' : 'views'}</span>
            <span className="flex items-center gap-1"><LinkIcon className="w-3 h-3" />{pageViews} page {pageViews === 1 ? 'view' : 'views'}</span>
            <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{shortDate(mention.created_at)}</span>
            {wasEdited && <span className="italic">edited</span>}
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <Link
              href={getViewOnMapHref(mention)}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
            >
              <MapPinIcon className="w-3 h-3" />
              View on Map
            </Link>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ShareIcon className="w-3 h-3" />
              Share
            </button>
            {isOwner && (
              <Link
                href={`/mention/${mention.id}/edit`}
                className="flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <PencilIcon className="w-3 h-3" />
                Edit
              </Link>
            )}
            {mention.accounts?.username && (
              <Link
                href={`/${mention.accounts.username}`}
                className="ml-auto flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                Profile
              </Link>
            )}
          </div>
        </div>
      </article>

      {/* Full-screen image overlay */}
      {selectedImageIndex !== null && (
        <ImageOverlay
          images={images}
          currentIndex={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
          onNavigate={(index) => setSelectedImageIndex(index)}
        />
      )}
    </>
  );
}
