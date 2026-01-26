'use client';

import { ExclamationTriangleIcon, XCircleIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ErrorContentProps {
  statusCode?: 401 | 404 | 500;
  title?: string;
  message?: string;
  error?: Error | string | null;
  showHomeButton?: boolean;
  homeButtonText?: string;
}

export function ErrorContent({
  statusCode,
  title,
  message,
  error,
  showHomeButton = true,
  homeButtonText = 'Go to Homepage',
}: ErrorContentProps) {
  const router = useRouter();

  // Default content based on status code
  const getDefaultContent = () => {
    switch (statusCode) {
      case 401:
        return {
          title: 'Unauthorized',
          message: 'You need to sign in to access this page.',
          icon: ShieldExclamationIcon,
          iconColor: 'text-yellow-500',
        };
      case 404:
        return {
          title: 'Page Not Found',
          message: "The page you're looking for doesn't exist or may have been removed.",
          icon: XCircleIcon,
          iconColor: 'text-gray-500',
        };
      case 500:
      default:
        return {
          title: title || 'Something went wrong',
          message: message || "We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.",
          icon: ExclamationTriangleIcon,
          iconColor: 'text-red-500',
        };
    }
  };

  const content = getDefaultContent();
  const Icon = content.icon;

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-4">
        <Icon className={`w-16 h-16 ${content.iconColor} mx-auto`} />
        <h1 className="text-2xl font-bold text-gray-900">{content.title}</h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          {message || content.message}
        </p>
        {error && process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
            <p className="text-xs font-mono text-red-800 break-words">
              {typeof error === 'string' ? error : error.toString()}
            </p>
          </div>
        )}
        {showHomeButton && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
            >
              {homeButtonText}
            </button>
            {statusCode === 401 && (
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('redirect', window.location.pathname);
                  router.push(`/?redirect=${encodeURIComponent(window.location.pathname)}&message=Please sign in to access this page`);
                }}
                className="inline-flex items-center px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
