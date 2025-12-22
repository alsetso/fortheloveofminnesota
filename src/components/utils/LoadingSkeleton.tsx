'use client';

import { ReactNode } from 'react';

interface LoadingSkeletonProps {
  children?: ReactNode;
  className?: string;
}

/**
 * LoadingSkeleton - Reusable loading skeleton component
 * 
 * Use this for consistent loading states across the app.
 * Prevents content flash by showing placeholder content.
 */
export default function LoadingSkeleton({ children, className = '' }: LoadingSkeletonProps) {
  if (children) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`animate-pulse ${className}`}>
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    </div>
  );
}

/**
 * PageLoadingSkeleton - Full page loading skeleton
 */
export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gold-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-gray-600 font-medium">Loading...</div>
      </div>
    </div>
  );
}

/**
 * AuthLoadingSkeleton - Auth-specific loading skeleton
 */
export function AuthLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-black border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

