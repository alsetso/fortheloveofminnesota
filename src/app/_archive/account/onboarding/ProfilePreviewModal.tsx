'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { AccountTrait } from '@/features/auth';
import AccountTraits from '@/components/profile/AccountTraits';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ProfilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  formData: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    bio: string;
    traits: AccountTrait[];
    image_url: string | null;
    cover_image_url: string | null;
  };
}

export default function ProfilePreviewModal({
  isOpen,
  onClose,
  onComplete,
  formData,
}: ProfilePreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap and restore focus
  useEffect(() => {
    if (!isOpen) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the modal
    const modal = modalRef.current;
    if (modal) {
      const firstFocusable = modal.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Handle tab trapping
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modal) return;

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTab);
      // Restore focus to previous element
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = formData.first_name && formData.last_name
    ? `${formData.first_name} ${formData.last_name}`
    : formData.username || 'User';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-md border border-gray-200 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-[10px] border-b border-gray-200">
          <h2 id="preview-modal-title" className="text-sm font-semibold text-gray-900">Profile Preview</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-50 rounded-md transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Profile Card Preview */}
        <div className="p-[10px]">
          <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
            {/* Cover Image/Banner */}
            <div className="h-16 bg-gray-100 relative overflow-hidden">
              {formData.cover_image_url ? (
                <Image
                  src={formData.cover_image_url}
                  alt="Cover"
                  fill
                  className="object-cover"
                  unoptimized={formData.cover_image_url.includes('supabase.co')}
                />
              ) : null}
            </div>

            <div className="p-[10px]">
              {/* Profile Photo - Overlapping Cover */}
              <div className="relative -mt-8 mb-2">
                <div className="w-14 h-14 rounded-full bg-gray-100 border border-white overflow-hidden">
                  {formData.image_url ? (
                    <Image
                      src={formData.image_url}
                      alt={displayName}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                      unoptimized={formData.image_url.includes('supabase.co')}
                    />
                  ) : (
                    <div className="w-14 h-14 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500 font-medium text-lg">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Info */}
              <div className="space-y-2">
                <div>
                  <h3 className="text-xs font-semibold text-gray-900">
                    {displayName}
                  </h3>
                  {formData.username && (
                    <p className="text-xs text-gray-500">
                      @{formData.username}
                    </p>
                  )}
                  {formData.email && (
                    <p className="text-xs text-gray-500">
                      {formData.email}
                    </p>
                  )}
                  {formData.phone && (
                    <p className="text-xs text-gray-500">
                      {formData.phone}
                    </p>
                  )}
                </div>

                {formData.bio && (
                  <p className="text-xs text-gray-600">
                    {formData.bio}
                  </p>
                )}

                {formData.traits.length > 0 && (
                  <div>
                    <AccountTraits
                      traits={formData.traits}
                      editable={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-[10px] border-t border-gray-200 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Continue Editing
          </button>
          <button
            onClick={onComplete}
            className="flex-1 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            Complete Account
          </button>
        </div>
      </div>
    </div>
  );
}



