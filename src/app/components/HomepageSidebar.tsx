'use client';

import { useMemo } from 'react';
import { useAccountData } from '@/features/account/hooks/useAccountData';
import ProfileCard from '@/features/profiles/components/ProfileCard';
import NewsSecondaryContent from '@/features/sidebar/components/NewsSecondaryContent';
import type { ProfileAccount } from '@/types/profile';

export default function HomepageSidebar() {
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

  return (
    <div className="space-y-2">
      {/* Profile Card - Read Only View */}
      {profileAccount ? (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <ProfileCard 
            account={profileAccount} 
            isOwnProfile={false}
          />
        </div>
      ) : (
        <div className="h-[100px] bg-white border border-gray-200 rounded-md"></div>
      )}

      {/* News Section */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <NewsSecondaryContent />
      </div>
    </div>
  );
}

