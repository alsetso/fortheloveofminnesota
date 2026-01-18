'use client';

import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface ImagePreviewContainerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
}

export default function ImagePreviewContainer({
  isOpen,
  onClose,
  imageUrl,
  alt = 'Image preview',
}: ImagePreviewContainerProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 pointer-events-auto"
        onClick={onClose}
      />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors pointer-events-auto"
        aria-label="Close"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>

      {/* Image Container */}
      <div className="relative w-full h-full flex items-center justify-center p-4 pointer-events-none">
        <div className="relative max-w-full max-h-full">
          <Image
            src={imageUrl}
            alt={alt}
            width={1200}
            height={800}
            className="max-w-full max-h-[90vh] object-contain"
            unoptimized={imageUrl.startsWith('data:') || imageUrl.includes('supabase.co')}
            priority
          />
        </div>
      </div>
    </div>
  );
}
