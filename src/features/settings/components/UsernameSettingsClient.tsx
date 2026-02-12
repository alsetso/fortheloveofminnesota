'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { AccountService } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { useRouter } from 'next/navigation';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function UsernameSettingsClient() {
  const { account: initialAccount } = useSettings();
  const { success, error: showError } = useToast();
  const router = useRouter();
  
  const [username, setUsername] = useState(initialAccount?.username || '');
  const [isSaving, setIsSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    setUsername(initialAccount?.username || '');
  }, [initialAccount]);

  // Check username availability
  useEffect(() => {
    if (username === initialAccount?.username) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      setUsernameError(null);
      return;
    }
    
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      if (username.length > 0 && username.length < 3) {
        setUsernameError('Username must be at least 3 characters');
      } else {
        setUsernameError(null);
      }
      return;
    }
    
    if (username.length > 30) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      setUsernameError('Username must be 30 characters or less');
      return;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      setUsernameError('Username can only contain letters, numbers, hyphens, and underscores');
      return;
    }
    
    setUsernameError(null);
    setCheckingUsername(true);
    
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch('/api/accounts/username/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: username.trim().toLowerCase() }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setUsernameAvailable(data.available);
        } else {
          setUsernameAvailable(null);
        }
      } catch (err) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [username, initialAccount?.username]);

  const handleSave = async () => {
    if (isSaving) return;
    
    // Validation
    if (!username || username.trim().length < 3) {
      showError('Error', 'Username must be at least 3 characters');
      return;
    }
    
    if (username.trim().length > 30) {
      showError('Error', 'Username must be 30 characters or less');
      return;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      showError('Error', 'Username can only contain letters, numbers, hyphens, and underscores');
      return;
    }
    
    if (usernameAvailable === false) {
      showError('Error', 'Username is not available. Please choose another.');
      return;
    }
    
    if (username.trim().toLowerCase() === initialAccount?.username?.toLowerCase()) {
      // No change
      return;
    }
    
    setIsSaving(true);
    setUsernameError(null);
    
    try {
      await AccountService.updateCurrentAccount(
        {
          username: username.trim().toLowerCase(),
        },
        initialAccount?.id
      );
      
      success('Updated', 'Username updated successfully');
      
      // Refresh the page to update the sidebar and other components
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update username';
      showError('Error', errorMessage);
      setUsernameError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = username.trim().toLowerCase() !== initialAccount?.username?.toLowerCase();
  const isValid = username.trim().length >= 3 && 
                  username.trim().length <= 30 && 
                  /^[a-zA-Z0-9_-]+$/.test(username.trim()) &&
                  usernameAvailable !== false;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Username</h1>
        <p className="text-xs text-gray-500 mt-1">
          Your username is how others will find and mention you. You can change it at any time.
        </p>
      </div>

      {/* Username Input */}
      <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
        <div>
          <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1.5">
            Username
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              @
            </div>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full pl-8 pr-10 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                usernameError || usernameAvailable === false
                  ? 'border-red-300 bg-red-50'
                  : usernameAvailable === true
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300'
              }`}
              placeholder="username"
              maxLength={30}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checkingUsername && (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              )}
              {!checkingUsername && usernameAvailable === true && username !== initialAccount?.username && (
                <CheckIcon className="w-5 h-5 text-green-600" />
              )}
              {!checkingUsername && usernameAvailable === false && (
                <XMarkIcon className="w-5 h-5 text-red-600" />
              )}
            </div>
          </div>
          
          {/* Error Message */}
          {usernameError && (
            <p className="text-xs text-red-600 mt-1.5">{usernameError}</p>
          )}
          
          {/* Availability Message */}
          {!usernameError && !checkingUsername && usernameAvailable === false && (
            <p className="text-xs text-red-600 mt-1.5">This username is already taken</p>
          )}
          
          {!usernameError && !checkingUsername && usernameAvailable === true && username !== initialAccount?.username && (
            <p className="text-xs text-green-600 mt-1.5">This username is available</p>
          )}
          
          {/* Help Text */}
          {!usernameError && usernameAvailable === null && username && (
            <p className="text-xs text-gray-500 mt-1.5">
              Username must be 3-30 characters and can only contain letters, numbers, hyphens, and underscores
            </p>
          )}
        </div>

        {/* Current Username Display */}
        {initialAccount?.username && (
          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Current username</p>
            <p className="text-sm font-medium text-gray-900">@{initialAccount.username}</p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={!hasChanges || !isValid || isSaving || checkingUsername}
            className="px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <p className="text-xs text-blue-900">
          <strong>Note:</strong> Changing your username will update your profile URL. Any links to your old username will no longer work.
        </p>
      </div>
    </div>
  );
}
