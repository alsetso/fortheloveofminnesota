'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPinIcon, EyeIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { MentionService } from '../services/mentionService';
import { LikeService } from '../services/likeService';
import { useRouter } from 'next/navigation';
import { usePageView } from '@/hooks/usePageView';
import { MAP_CONFIG } from '@/features/map/config';
import { useAuthStateSafe } from '@/features/auth';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import LikeButton from '@/components/mentions/LikeButton';

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
    view_count: number | null;
    likes_count?: number;
    is_liked?: boolean;
    created_at: string;
    updated_at: string;
    account_id: string | null;
    accounts?: {
      id: string;
      username: string | null;
      first_name: string | null;
      image_url: string | null;
    } | null;
  };
  isOwner: boolean;
}

export default function MentionDetailClient({ mention, isOwner }: MentionDetailClientProps) {
  const { account } = useAuthStateSafe();
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewCount, setViewCount] = useState(mention.view_count || 0);
  const [likesCount, setLikesCount] = useState(mention.likes_count || 0);
  const [isLiked, setIsLiked] = useState(mention.is_liked || false);
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Fetch likes data if not provided
  useEffect(() => {
    const fetchLikesData = async () => {
      if (!account?.id || mention.likes_count !== undefined) return;

      try {
        const [count, liked] = await Promise.all([
          LikeService.getLikeCount(mention.id),
          LikeService.hasLiked(mention.id, account.id),
        ]);
        setLikesCount(count);
        setIsLiked(liked);
      } catch (error) {
        console.error('[MentionDetailClient] Error fetching likes:', error);
      }
    };

    fetchLikesData();
  }, [mention.id, account?.id, mention.likes_count]);

  // Track page view
  usePageView({ page_url: `/mention/${mention.id}` });

  // Optimistically increment view count on mount
  useEffect(() => {
    setViewCount(prev => prev + 1);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [mention.lng, mention.lat],
      zoom: 14,
    });

    mapRef.current = map;

    // Add marker
    const marker = new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat([mention.lng, mention.lat])
      .addTo(map);

    markerRef.current = marker;

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [mention.lat, mention.lng]);

  const accountName = mention.accounts?.first_name || mention.accounts?.username || 'Anonymous';
  const createdDate = new Date(mention.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this mention?')) return;

    setIsDeleting(true);
    try {
      await MentionService.deleteMention(mention.id);
      router.push('/');
    } catch (error) {
      console.error('Error deleting mention:', error);
      alert('Failed to delete mention');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Love of Minnesota"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="text-sm font-semibold text-gray-900">Love of Minnesota</span>
            </Link>
            <Link
              href={`/?mention=${mention.id}`}
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              View on Map
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-[600px] mx-auto px-4 py-6">
          {/* Author Info */}
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
              <div>
                <div className="text-sm font-medium text-gray-900">{accountName}</div>
                {mention.accounts.username && (
                  <Link
                    href={`/profile/${mention.accounts.username}`}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    @{mention.accounts.username}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Media */}
          {mention.media_type === 'image' && mention.image_url && (
            <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
              <Image
                src={mention.image_url}
                alt="Mention"
                width={600}
                height={400}
                className="w-full h-auto"
                unoptimized={mention.image_url.includes('supabase.co')}
              />
            </div>
          )}

          {/* Description */}
          {mention.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-900 leading-relaxed">{mention.description}</p>
            </div>
          )}

          {/* Map */}
          <div className="mb-4 rounded-lg overflow-hidden border border-gray-200" style={{ height: '300px' }}>
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>

          {/* Location */}
          {mention.full_address && (
            <div className="mb-4 flex items-start gap-2 text-xs text-gray-600">
              <MapPinIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span>{mention.full_address}</span>
            </div>
          )}

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-1">
              <EyeIcon className="w-4 h-4" />
              <span>{viewCount} views</span>
            </div>
            {account && (
              <LikeButton
                mentionId={mention.id}
                initialLiked={isLiked}
                initialCount={likesCount}
                onLikeChange={(liked, count) => {
                  setIsLiked(liked);
                  setLikesCount(count);
                }}
                size="sm"
                showCount={true}
              />
            )}
            <div>
              <span>{createdDate}</span>
            </div>
          </div>

          {/* Owner Actions */}
          {isOwner && (
            <div className="flex items-center gap-2">
              <Link
                href={`/mention/${mention.id}/edit`}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </Link>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
