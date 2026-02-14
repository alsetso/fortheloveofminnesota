'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

/**
 * Shared sign-out button with confirmation modal.
 * Use in any settings page instead of duplicating sign-out logic.
 */
export default function SignOutButton() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsSigningOut(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isSigningOut}
        className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-400" />
        <span className="flex-1 text-left">{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}
        >
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-4 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Sign out of your account?</h3>
            <p className="text-xs text-foreground-muted mb-4">
              You&apos;ll need to sign in again to access your account.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-3 py-2 text-xs font-medium text-foreground-muted bg-surface-accent rounded-md hover:bg-surface-accent/80 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSigningOut}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
