'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, AccountService, Account } from '@/features/auth';
import { GuestAccountService, type GuestAccount } from '@/features/auth/services/guestAccountService';
import ProfilePhoto from '@/components/ProfilePhoto';

interface TopNavProps {
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
  isAccountModalOpen?: boolean;
  onAccountModalOpen?: () => void;
  onWelcomeModalOpen?: () => void;
  hasCompletedGuestProfile?: boolean;
}

export default function TopNav({ 
  isAccountModalOpen = false, 
  onAccountModalOpen, 
  onWelcomeModalOpen,
  hasCompletedGuestProfile = false,
}: TopNavProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [guestAccount, setGuestAccount] = useState<GuestAccount | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchAccount = async () => {
      if (user) {
        try {
          const accountData = await AccountService.getCurrentAccount();
          setAccount(accountData);
          setGuestAccount(null);
          setGuestName(null);
        } catch (error) {
          console.error('Error fetching account:', error);
        }
      } else {
        // Load guest name for display
        const name = GuestAccountService.getGuestName();
        setGuestName(name);
        setAccount(null);

        // If profile is complete, fetch guest account from Supabase
        if (hasCompletedGuestProfile) {
          try {
            const guestId = GuestAccountService.getGuestId();
            const account = await GuestAccountService.getGuestAccountByGuestId(guestId);
            if (account) {
              setGuestAccount(account);
            } else {
              // Account doesn't exist yet, try to create it
              try {
                const newAccount = await GuestAccountService.getOrCreateGuestAccount();
                setGuestAccount(newAccount);
              } catch (error) {
                console.error('[TopNav] Error creating guest account:', error);
              }
            }
          } catch (error) {
            console.error('[TopNav] Error fetching guest account:', error);
          }
        } else {
          setGuestAccount(null);
        }
      }
    };

    fetchAccount();
  }, [user, hasCompletedGuestProfile]);

  return (
    <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-end px-4 py-3 bg-transparent">
      {/* Account/Guest Button */}
      {!user ? (
        hasCompletedGuestProfile && guestAccount ? (
          // Show guest account image after profile completion
          <button
            onClick={() => onAccountModalOpen?.()}
            className="flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-white hover:text-white hover:bg-white/10"
          >
            <ProfilePhoto 
              account={guestAccount as Account}
              size="sm"
              editable={false}
            />
          </button>
        ) : (
          // Show "Guest" button until profile is complete
          <button
            onClick={() => onAccountModalOpen?.()}
            className="px-4 py-2 text-sm text-white hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors border border-white/20"
          >
            Guest
          </button>
        )
      ) : (
        <button
          onClick={() => onAccountModalOpen?.()}
          className="flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-white hover:text-white hover:bg-white/10"
        >
          <ProfilePhoto 
            account={account}
            size="sm"
            editable={false}
          />
        </button>
      )}
    </div>
  );
}


