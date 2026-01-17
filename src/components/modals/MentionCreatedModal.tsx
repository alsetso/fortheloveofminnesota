'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { XMarkIcon, ShareIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { Mention } from '@/types/mention';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface MentionCreatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  mention: Mention | null;
  map: MapboxMapInstance | null;
}

export default function MentionCreatedModal({
  isOpen,
  onClose,
  mention,
  map,
}: MentionCreatedModalProps) {
  const [mapScreenshot, setMapScreenshot] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && mention && map) {
      captureMapScreenshot();
      // Trigger confetti
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [isOpen, mention, map]);

  const captureMapScreenshot = async () => {
    if (!map || !mention || isCapturing) return;

    setIsCapturing(true);
    try {
      // Brief wait for map to be ready (parent already waited 800ms for pin to appear)
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = (map as any).getCanvas();
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        setMapScreenshot(dataUrl);
      }
    } catch (error) {
      console.error('[MentionCreatedModal] Error capturing screenshot:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const shareUrl = mention ? `${window.location.origin}/mention/${mention.id}` : '';

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('[MentionCreatedModal] Error copying to clipboard:', error);
    }
  };

  const handleShare = async () => {
    if (!mention || !shareUrl) return;

    const shareData = {
      title: 'Check out my mention on Love of Minnesota',
      text: mention.description || 'I just created a mention on the map!',
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback to copy
        handleCopyLink();
      }
    } catch (error) {
      // User cancelled or error occurred
      console.debug('[MentionCreatedModal] Share cancelled or failed:', error);
    }
  };

  if (!isOpen || !mention || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10%',
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${2 + Math.random() * 1}s`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][Math.floor(Math.random() * 5)],
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden relative">
        {/* Close Button - Top Right */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors shadow-sm border border-gray-200"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Map Screenshot */}
          {mapScreenshot ? (
            <div className="relative w-full aspect-video rounded-md overflow-hidden border border-gray-200 bg-gray-100">
              <Image
                src={mapScreenshot}
                alt="Map with your pin"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="relative w-full aspect-video rounded-md overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
              <div className="text-sm text-gray-500">Capturing map...</div>
            </div>
          )}

          {/* Description */}
          {mention.description && (
            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-xs text-gray-700 leading-relaxed">"{mention.description}"</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
            >
              <ShareIcon className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {isCopied ? (
                <>
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
