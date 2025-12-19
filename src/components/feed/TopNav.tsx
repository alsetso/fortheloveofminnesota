'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, AccountService, Account } from '@/features/auth';
import AccountSwitcherDropdown from './AccountSwitcherDropdown';

interface TopNavProps {
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
  isAccountModalOpen?: boolean;
  onAccountModalOpen?: () => void;
  onWelcomeModalOpen?: () => void;
  variant?: 'homepage' | 'profile';
}

export default function TopNav({ 
  isAccountModalOpen = false, 
  onAccountModalOpen, 
  onWelcomeModalOpen,
  variant = 'homepage',
}: TopNavProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchAccount = async () => {
      if (user) {
        try {
          const accountData = await AccountService.getCurrentAccount();
          setAccount(accountData);
        } catch (error) {
          console.error('Error fetching account:', error);
        }
      } else {
        setAccount(null);
      }
    };

    fetchAccount();
  }, [user]);

  // Get the profile URL based on account username
  const profileUrl = account?.username ? `/profile/${account.username}` : null;

  // Handle account selection from dropdown
  const handleAccountSelect = () => {
    onAccountModalOpen?.();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-end gap-2 px-4 py-3 bg-transparent">
      {/* Navigation Link - Profile on homepage, Community on profile page */}
      {variant === 'profile' ? (
        <Link
          href="/"
          className="text-xs text-white/90 hover:text-white transition-colors"
        >
          Community
        </Link>
      ) : (
        profileUrl && (
          <Link
            href={profileUrl}
            className="text-xs text-white/90 hover:text-white transition-colors"
          >
            Profile
          </Link>
        )
      )}

      {/* Account Switcher Dropdown */}
      <AccountSwitcherDropdown 
        variant="dark"
        onAccountSelect={handleAccountSelect}
        onCreateNew={() => onAccountModalOpen?.()}
      />
    </div>
  );
}


