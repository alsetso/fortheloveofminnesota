'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface LoginOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: () => void;
}

export default function LoginOverlayModal({ isOpen, onClose, onLogin }: LoginOverlayModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-gray-600" />
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-black mb-4">
            Sign In Required
          </h2>
          <p className="text-gray-600 mb-6">
            This post is only available to members. Please sign in to view the full content.
          </p>
          
          <div className="flex flex-col gap-3">
            <Link
              href="/?modal=welcome"
              onClick={onLogin}
              className="w-full px-6 py-3 bg-gold-500 text-black font-semibold rounded-lg hover:bg-gold-600 transition-colors text-center"
            >
              Sign In
            </Link>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

