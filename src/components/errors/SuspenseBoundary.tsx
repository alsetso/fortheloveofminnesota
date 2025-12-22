'use client';

import { Suspense, ReactNode } from 'react';
import LoadingSkeleton, { PageLoadingSkeleton, AuthLoadingSkeleton } from '@/components/utils/LoadingSkeleton';

interface SuspenseBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  type?: 'page' | 'auth' | 'default';
}

/**
 * SuspenseBoundary - Wrapper component for React Suspense with consistent loading states
 * 
 * Use this to wrap async server components or data fetching operations.
 * Provides consistent loading states across the application.
 */
export function SuspenseBoundary({ 
  children, 
  fallback,
  type = 'default'
}: SuspenseBoundaryProps) {
  let defaultFallback: ReactNode;
  
  switch (type) {
    case 'page':
      defaultFallback = <PageLoadingSkeleton />;
      break;
    case 'auth':
      defaultFallback = <AuthLoadingSkeleton />;
      break;
    default:
      defaultFallback = <LoadingSkeleton />;
  }

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
}

/**
 * PageSuspense - Suspense boundary for full page loading
 */
export function PageSuspense({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <SuspenseBoundary type="page" fallback={fallback}>{children}</SuspenseBoundary>;
}

/**
 * AuthSuspense - Suspense boundary for auth-related loading
 */
export function AuthSuspense({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <SuspenseBoundary type="auth" fallback={fallback}>{children}</SuspenseBoundary>;
}



