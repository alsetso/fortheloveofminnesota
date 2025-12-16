'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, AccountService, Account } from '@/features/auth';

interface SettingsClientProps {
  initialAccount: Account;
  userEmail: string;
}

export default function SettingsClient({ initialAccount, userEmail }: SettingsClientProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [account] = useState<Account>(initialAccount);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const handleSignOutClick = () => {
    setShowSignOutConfirm(true);
  };

  const handleSignOutConfirm = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    setShowSignOutConfirm(false);
    
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setSignOutError('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOutCancel = () => {
    setShowSignOutConfirm(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-[10px] bg-white border border-gray-200 rounded-md">
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-gray-900">Settings</h1>
        </div>
        <p className="text-xs text-gray-600">Manage your account settings and preferences</p>
      </div>

      {/* Account Details */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Email</dt>
            <dd className="text-xs font-medium text-gray-900">{userEmail}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Role</dt>
            <dd className="text-xs font-medium text-gray-900 capitalize">{account.role || 'general'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Account created</dt>
            <dd className="text-xs font-medium text-gray-900">
              {account.created_at ? new Date(account.created_at).toLocaleDateString() : 'Unknown'}
            </dd>
          </div>
        </div>
      </div>

      {/* Account Actions */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Actions</h3>
        
        {signOutError && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{signOutError}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
          <div>
            <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Sign Out</h4>
            <p className="text-xs text-gray-600">Sign out of your account on this device</p>
          </div>
          <button
            onClick={handleSignOutClick}
            disabled={isSigningOut}
            className="flex items-center gap-1.5 px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningOut ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Signing out...
              </>
            ) : (
              'Sign Out'
            )}
          </button>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4">
            <div className="p-[10px]">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 w-8 h-8 mx-auto bg-red-100 rounded-md flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                  Sign out of your account?
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  You&apos;ll need to sign in again to access your account.
                </p>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleSignOutCancel}
                    className="flex-1 px-[10px] py-[10px] text-xs font-medium text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSignOutConfirm}
                    disabled={isSigningOut}
                    className="flex-1 px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
