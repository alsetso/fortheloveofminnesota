'use client';

import SignInGate from '@/components/auth/SignInGate';
import { MapPinIcon, HeartIcon, UserPlusIcon, EyeIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

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
  const accountName = mention.accounts?.first_name || mention.accounts?.username || 'Someone';
  const previewDescription = mention.description 
    ? (mention.description.length > 150 ? `${mention.description.slice(0, 150)}...` : mention.description)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview Section - Teaser Content */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[600px] mx-auto px-4 py-6">
          {/* Author Preview */}
          {mention.accounts && (
            <div className="flex items-center gap-2 mb-4">
              {mention.accounts.image_url ? (
                <Image
                  src={mention.accounts.image_url}
                  alt={accountName}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover"
                  unoptimized={mention.accounts.image_url.includes('supabase.co')}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {accountName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{accountName}</div>
                {mention.accounts.username && (
                  <div className="text-xs text-gray-500">
                    @{mention.accounts.username}
                  </div>
                )}
              </div>
              {mention.mention_type && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
                  <span className="text-sm">{mention.mention_type.emoji}</span>
                  <span className="text-xs font-medium text-gray-700">{mention.mention_type.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Image Preview (blurred/teaser) */}
          {mention.image_url && (
            <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 relative">
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-white/90 backdrop-blur-sm rounded-md px-4 py-2 border border-gray-200">
                  <p className="text-xs font-medium text-gray-700">Sign in to view full image</p>
                </div>
              </div>
              <Image
                src={mention.image_url}
                alt=""
                width={600}
                height={400}
                className="w-full h-auto opacity-30 blur-sm"
                unoptimized={mention.image_url.includes('supabase.co')}
              />
            </div>
          )}

          {/* Description Preview */}
          {previewDescription && (
            <div className="mb-4">
              <p className="text-sm text-gray-900 leading-relaxed">{previewDescription}</p>
              {mention.description && mention.description.length > 150 && (
                <p className="text-xs text-gray-500 mt-2">Sign in to read more...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sign In Gate */}
      <SignInGate
        title="Sign in to view this mention"
        description={`See what ${accountName} shared and join thousands of Minnesotans exploring their state.`}
        features={[
          { icon: <EyeIcon className="w-5 h-5" />, text: 'View full mentions and images' },
          { icon: <HeartIcon className="w-5 h-5" />, text: 'Like and interact with posts' },
          { icon: <MapPinIcon className="w-5 h-5" />, text: 'Explore the live map' },
          { icon: <UserPlusIcon className="w-5 h-5" />, text: 'Connect with the community' },
        ]}
      />
    </div>
  );
}
