'use client';

import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface CameraImagePreviewProps {
  imageBlob: Blob;
  imagePreview: string;
  onRemove: () => void;
  className?: string;
}

/**
 * Floating image preview shown after camera capture
 * Appears in bottom right corner, waiting for user to select location on map
 */
export default function CameraImagePreview({
  imageBlob,
  imagePreview,
  onRemove,
  className = '',
}: CameraImagePreviewProps) {
  return (
    <div
      className={`fixed bottom-4 right-4 z-[55] bg-white rounded-lg shadow-lg border border-gray-200 p-2 ${className}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative w-24 h-24 rounded-md overflow-hidden bg-gray-100">
        <Image
          src={imagePreview}
          alt="Captured image preview"
          fill
          className="object-cover"
          unoptimized
        />
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
          aria-label="Remove image"
        >
          <XMarkIcon className="w-3 h-3" />
        </button>
      </div>
      <p className="text-[10px] text-gray-600 mt-1 text-center">
        Click map to place
      </p>
    </div>
  );
}

