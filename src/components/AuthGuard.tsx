'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';

interface AuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireRole?: 'admin' | 'general';
  redirectTo?: string;
  fallback?: ReactNode;
}

/**
 * AuthGuard - Client-side authentication and role protection
 * 
 * Use this component to protect routes that require authentication or specific roles.
 * For server components, use getServerAuth() directly.
 */
export default function AuthGuard({
  children,
  requireAuth = true,
  requireRole,
  redirectTo = '/?modal=welcome',
  fallback,
}: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (requireAuth && !user) {
      router.push(redirectTo);
      return;
    }

    // Role checking would require member data, which is not in AuthContext
    // For role-based protection, use server components with getServerAuth()
    if (requireRole && !user) {
      router.push(redirectTo);
    }
  }, [user, isLoading, requireAuth, requireRole, redirectTo, router]);

  // Show loading state
  if (isLoading) {
    return (
      fallback || (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-black border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    );
  }

  // Don't render if auth required but not authenticated
  if (requireAuth && !user) {
    return null;
  }

  return <>{children}</>;
}

