'use client';

import SignInGate from '@/components/auth/SignInGate';
import { MapPinIcon, HeartIcon, UserPlusIcon, EyeIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { type MultiImage, MultiImageGrid } from '@/components/shared/MultiImageGrid';

interface MentionDetailGateProps {
  mention: {
    id: string;
    description: string | null;
    image_url: string | null;
    accounts?: {
      username: string | null;
      first_name: string | null;
      image_url: string | null;
    } | null;
    mention_type?: {
      emoji: string;
      name: string;
    } | null;
  };
}

export default function MentionDetailGate({ mention }: MentionDetailGateProps) {
  const { openWelcome } = useAppModalContextSafe();
  const accountName = mention.accounts?.first_name || mention.accounts?.username || 'Someone';

  const previewDescription = mention.description
    ? (mention.description.length > 10 ? `${mention.description.slice(0, 10)}...` : mention.description)
    : null;

  // Build images
  const images: MultiImage[] = [];
  if (mention.image_url) {
    images.push({ url: mention.image_url, alt: mention.description ?? undefined });
  }

  return (
    <div className="space-y-3">
      {/* ── Card: Author preview ── */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="flex items-center gap-2">
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
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate">{accountName}</div>
            {mention.accounts?.username && (
              <Link
                href={`/${mention.accounts.username}`}
                className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
              >
                @{mention.accounts.username}
              </Link>
            )}
          </div>
          {mention.mention_type && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 flex-shrink-0">
              <span className="text-xs">{mention.mention_type.emoji}</span>
              <span className="text-[10px] font-medium text-gray-600">{mention.mention_type.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Card: Content teaser ── */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        {images.length > 0 && (
          <div className="relative cursor-pointer" onClick={openWelcome}>
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="bg-white/90 backdrop-blur-sm rounded-md px-3 py-1.5 border border-gray-200">
                <p className="text-[10px] font-medium text-gray-700">Sign in to view full images</p>
              </div>
            </div>
            <div className="opacity-30 blur-sm pointer-events-none">
              <MultiImageGrid
                images={images}
                postHref={`/mention/${mention.id}`}
                className="rounded-none"
              />
            </div>
          </div>
        )}

        {previewDescription && (
          <div className="p-[10px]">
            <p className="text-xs text-gray-900 leading-relaxed">{previewDescription}</p>
            {mention.description && mention.description.length > 10 && (
              <button onClick={openWelcome} className="text-[10px] text-blue-600 hover:text-blue-700 hover:underline mt-1 font-medium">
                Sign in to read more...
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Skeletons for hidden data ── */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-200 rounded animate-pulse" /><div className="h-3 w-28 bg-gray-200 rounded animate-pulse" /></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-200 rounded animate-pulse" /><div className="h-3 w-36 bg-gray-200 rounded animate-pulse" /></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="flex items-center gap-3">
          <div className="h-3 w-14 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-18 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* ── Sign In Gate ── */}
      <SignInGate
        title="Sign in to view this mention"
        description={`See what ${accountName} shared and join thousands of Minnesotans exploring their state.`}
        features={[
          { icon: <EyeIcon className="w-4 h-4" />, text: 'View full mentions and images' },
          { icon: <HeartIcon className="w-4 h-4" />, text: 'Like and interact with posts' },
          { icon: <MapPinIcon className="w-4 h-4" />, text: 'Explore the live map' },
          { icon: <UserPlusIcon className="w-4 h-4" />, text: 'Connect with the community' },
        ]}
      />
    </div>
  );
}
