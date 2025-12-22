'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface PinPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  screenshot: string | null;
  description: string | null;
  mediaPreview: string | null;
  isMediaVideo?: boolean;
  address: string | null;
  isSubmitting?: boolean;
}

export default function PinPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  screenshot,
  description,
  mediaPreview,
  isMediaVideo = false,
  address,
  isSubmitting = false,
}: PinPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1002] flex items-center justify-center p-[10px]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-md border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Preview Pin</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
            disabled={isSubmitting}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-[10px] space-y-3">
          {/* Screenshot */}
          {screenshot && (
            <div className="relative w-full aspect-video rounded-md overflow-hidden border border-gray-200">
              <Image
                src={screenshot}
                alt="Map preview"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          {/* Media Preview (if uploaded) */}
          {mediaPreview && (
            <div className="relative w-full aspect-video rounded-md overflow-hidden border border-gray-200">
              {isMediaVideo ? (
                <video
                  src={mediaPreview}
                  className="w-full h-full object-cover"
                  controls
                />
              ) : (
                <Image
                  src={mediaPreview}
                  alt="Media preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="text-xs text-gray-900 whitespace-pre-wrap">
              {description}
            </div>
          )}

          {/* Address */}
          {address && (
            <div className="text-xs text-gray-500">
              {address}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-[10px] py-[10px] border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-medium text-gray-900 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
