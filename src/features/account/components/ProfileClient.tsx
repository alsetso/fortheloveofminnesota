'use client';

import { useMemo } from 'react';
import { useAccountData } from '../hooks/useAccountData';
import ProfileCard from '@/features/profiles/components/ProfileCard';
import type { ProfileAccount } from '@/types/profile';

export default function ProfileClient() {
  const { account, userEmail } = useAccountData(true, 'profile');

  // Convert Account to ProfileAccount format
  const profileAccount: ProfileAccount | null = useMemo(() => {
    if (!account) return null;
    
    return {
      id: account.id,
      username: account.username,
      first_name: account.first_name,
      last_name: account.last_name,
      email: userEmail,
      phone: account.phone,
      image_url: account.image_url,
      cover_image_url: account.cover_image_url,
      bio: account.bio,
      city_id: account.city_id,
      view_count: account.view_count || 0,
      traits: account.traits,
      user_id: account.user_id,
      created_at: account.created_at,
    };
  }, [account, userEmail]);

  if (!profileAccount) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-gray-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ProfileCard 
        account={profileAccount} 
        isOwnProfile={true}
      />
    </div>
  );
}

