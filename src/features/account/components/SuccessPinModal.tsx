'use client';

import { useMemo, useState, useEffect } from 'react';
import { XMarkIcon, MapPinIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { generateMapStaticImageUrl } from '@/features/feed/utils/mapStaticImage';
import Image from 'next/image';

interface SuccessPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinData: {
    id?: string;
    lat: number;
    lng: number;
    description: string | null;
    media_url: string | null;
    status?: 'loading' | 'success' | 'error';
    error?: string;
  };
}

export default function SuccessPinModal({
  isOpen,
  onClose,
  pinData,
}: SuccessPinModalProps) {
  const status = pinData.status || 'loading';
  const [imageLoadError, setImageLoadError] = useState(false);
  
  // Generate map screenshot using Mapbox Static Images API
  const mapImageUrl = useMemo(() => {
    return generateMapStaticImageUrl(
      {
        type: 'pin',
        geometry: {
          type: 'Point',
          coordinates: [pinData.lng, pinData.lat],
        },
      },
      {
        width: 800,
        height: 400,
        zoom: 15,
      }
    );
  }, [pinData.lat, pinData.lng]);

  // Reset image error when media_url changes
  useEffect(() => {
    setImageLoadError(false);
  }, [pinData.media_url]);

  if (!isOpen) return null;

  const isSuccess = status === 'success';
  const isLoading = status === 'loading';
  const isError = status === 'error';
  
  // Determine if media is an image (for blob URLs, try image first)
  const isImage = pinData.media_url 
    ? (pinData.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || (pinData.media_url.startsWith('blob:') && !imageLoadError))
    : false;

  return (
    <div className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-md border border-gray-200 w-full max-w-[600px] mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            {isLoading && 'Posting Pin...'}
            {isSuccess && 'Pin Created!'}
            {isError && 'Failed to Create Pin'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-1"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Map Screenshot */}
          {mapImageUrl ? (
            <div className="relative w-full rounded-md overflow-hidden border border-gray-200">
              <Image
                src={mapImageUrl}
                alt="Pin location"
                width={800}
                height={400}
                className="w-full h-auto"
                unoptimized
              />
              {/* Pin indicator overlay */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                {isLoading && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
                )}
                {isSuccess && (
                  <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg" />
                )}
                {isError && (
                  <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg" />
                )}
              </div>
              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="relative w-full h-[200px] rounded-md overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <MapPinIcon className="w-8 h-8 text-red-500" />
                <span className="text-xs font-medium">Map preview unavailable</span>
              </div>
            </div>
          )}

          {/* Media if available */}
          {pinData.media_url && (
            <div className="relative w-full rounded-md overflow-hidden border border-gray-200">
              {isImage ? (
                <Image
                  src={pinData.media_url}
                  alt="Pin media"
                  width={800}
                  height={400}
                  className="w-full h-auto max-h-64 object-cover"
                  unoptimized
                  onError={() => setImageLoadError(true)}
                />
              ) : (
                <video
                  src={pinData.media_url}
                  className="w-full h-auto max-h-64 object-cover"
                  controls
                />
              )}
            </div>
          )}

          {/* Description if available */}
          {pinData.description && (
            <div className="px-2 py-2 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-900 whitespace-pre-wrap break-words">
                {pinData.description}
              </p>
            </div>
          )}

          {/* Status message */}
          <div className="text-center pt-2">
            {isLoading && (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-gray-600">Creating your pin...</p>
              </div>
            )}
            {isSuccess && (
              <div className="flex items-center justify-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
                <p className="text-xs text-gray-600">Your pin has been successfully created!</p>
              </div>
            )}
            {isError && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <XCircleIcon className="w-4 h-4 text-red-500" />
                  <p className="text-xs font-medium text-red-600">Failed to create pin</p>
                </div>
                {pinData.error && (
                  <p className="text-xs text-gray-600">{pinData.error}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
