'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { MultiImage } from '@/components/shared/MultiImageGrid';

interface ImageOverlayProps {
  images: MultiImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function ImageOverlay({
  images,
  currentIndex,
  onClose,
  onNavigate,
}: ImageOverlayProps) {
  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  // Prevent body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
        onNavigate(prevIndex);
      } else if (e.key === 'ArrowRight' && hasMultiple) {
        const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
        onNavigate(nextIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, images.length, hasMultiple, onClose, onNavigate]);

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    onNavigate(prevIndex);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    onNavigate(nextIndex);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
        aria-label="Close"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>

      {/* Navigation Buttons */}
      {hasMultiple && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            aria-label="Next image"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Image Counter */}
      {hasMultiple && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-3 py-1 bg-black/50 rounded-full text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Image Container — clicking the image itself does nothing; clicking the padding area closes */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <div
          className="relative max-w-full max-h-full"
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={currentImage.url}
            alt={currentImage.alt || `Image ${currentIndex + 1}`}
            width={1200}
            height={800}
            className="max-w-full max-h-[90vh] object-contain"
            unoptimized={currentImage.url.startsWith('data:') || currentImage.url.includes('supabase.co')}
            priority
          />
        </div>
      </div>
    </div>
  );
}
