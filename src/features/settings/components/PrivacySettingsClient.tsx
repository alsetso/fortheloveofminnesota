'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { AccountService, useAuth } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import type { ProfileAccount } from '@/types/profile';

export default function PrivacySettingsClient() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { account: initialAccount } = useSettings();
  const { success, error: showError } = useToast();
  const [account, setAccount] = useState<ProfileAccount>({
    ...initialAccount,
    search_visibility: initialAccount.search_visibility ?? false,
    account_taggable: initialAccount.account_taggable ?? false,
  });
  const [isUpdatingSearchable, setIsUpdatingSearchable] = useState(false);
  const [isUpdatingTaggable, setIsUpdatingTaggable] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => {
    setAccount({
      ...initialAccount,
      search_visibility: initialAccount.search_visibility ?? false,
      account_taggable: initialAccount.account_taggable ?? false,
    });
  }, [initialAccount]);

  const handleToggleSearchable = async () => {
    if (isUpdatingSearchable) return;
    setIsUpdatingSearchable(true);
    try {
      const newSearchable = !account.search_visibility;
      await AccountService.updateCurrentAccount({ search_visibility: newSearchable }, account.id);
      setAccount((prev) => ({ ...prev, search_visibility: newSearchable }));
      success('Updated', newSearchable ? 'Profile is now searchable' : 'Profile is no longer searchable');
    } catch {
      showError('Error', 'Failed to update search visibility');
    } finally {
      setIsUpdatingSearchable(false);
    }
  };

  const handleToggleTaggable = async () => {
    if (isUpdatingTaggable) return;
    setIsUpdatingTaggable(true);
    try {
      const newTaggable = !account.account_taggable;
      await AccountService.updateCurrentAccount({ account_taggable: newTaggable }, account.id);
      setAccount((prev) => ({ ...prev, account_taggable: newTaggable }));
      success('Updated', newTaggable ? 'Tagging enabled' : 'Tagging disabled');
    } catch {
      showError('Error', 'Failed to update taggable setting');
    } finally {
      setIsUpdatingTaggable(false);
    }
  };

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
    <div className="space-y-2">
      <div className="bg-white border border-gray-200 rounded-md p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900">Profile is searchable</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Allow others to find you in @ mention searches</p>
          </div>
          <div className="flex-shrink-0 ml-3">
            <button
              type="button"
              onClick={handleToggleSearchable}
              disabled={isUpdatingSearchable}
              className={`relative inline-flex h-5 w-9 cursor-pointer rounded-lg transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                account.search_visibility ? 'bg-green-500' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={account.search_visibility}
              aria-label="Toggle profile searchability"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-md bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  account.search_visibility ? 'translate-x-4' : 'translate-x-0.5'
                }`}
                style={{ marginTop: '2px' }}
              />
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-md p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900">Profile is taggable</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Allow others to tag you in mentions</p>
          </div>
          <div className="flex-shrink-0 ml-3">
            <button
              type="button"
              onClick={handleToggleTaggable}
              disabled={isUpdatingTaggable}
              className={`relative inline-flex h-5 w-9 cursor-pointer rounded-lg transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                account.account_taggable ? 'bg-green-500' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={account.account_taggable}
              aria-label="Toggle profile taggability"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-md bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  account.account_taggable ? 'translate-x-4' : 'translate-x-0.5'
                }`}
                style={{ marginTop: '2px' }}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Actions</h3>
        {signOutError && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{signOutError}</span>
          </div>
        )}
        <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
          <div>
            <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Sign Out</h4>
            <p className="text-xs text-gray-600">Sign out of your account on this device</p>
          </div>
          <button onClick={handleSignOutClick} disabled={isSigningOut} className="flex items-center gap-1.5 px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isSigningOut ? (<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing out...</>) : 'Sign Out'}
          </button>
        </div>
      </div>

      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" role="dialog" aria-modal="true" aria-labelledby="signout-title" onKeyDown={(e) => e.key === 'Escape' && handleSignOutCancel()}>
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4">
            <div className="p-[10px]">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 w-8 h-8 mx-auto bg-red-100 rounded-md flex items-center justify-center">
                  <ArrowRightOnRectangleIcon className="w-4 h-4 text-red-600" aria-hidden />
                </div>
              </div>
              <div className="text-center">
                <h3 id="signout-title" className="text-sm font-semibold text-gray-900 mb-1.5">Sign out of your account?</h3>
                <p className="text-xs text-gray-600 mb-3">You&apos;ll need to sign in again to access your account.</p>
                <div className="flex gap-2">
                  <button onClick={handleSignOutCancel} className="flex-1 px-[10px] py-[10px] text-xs font-medium text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors">Cancel</button>
                  <button onClick={handleSignOutConfirm} disabled={isSigningOut} className="flex-1 px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSigningOut ? 'Signing out...' : 'Sign out'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
