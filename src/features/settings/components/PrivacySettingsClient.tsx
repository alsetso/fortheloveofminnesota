'use client';

import { useState, useEffect } from 'react';
import { AccountService } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import type { ProfileAccount } from '@/types/profile';

export default function PrivacySettingsClient() {
  const { account: initialAccount } = useSettings();
  const { success, error: showError } = useToast();
  const [account, setAccount] = useState<ProfileAccount>({
    ...initialAccount,
    search_visibility: initialAccount.search_visibility ?? false,
    account_taggable: initialAccount.account_taggable ?? false,
  });
  const [isUpdatingSearchable, setIsUpdatingSearchable] = useState(false);
  const [isUpdatingTaggable, setIsUpdatingTaggable] = useState(false);

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
    </div>
  );
}
