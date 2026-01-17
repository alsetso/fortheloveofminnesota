'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ChevronUpIcon, ChevronDownIcon, UserIcon } from '@heroicons/react/24/outline';
import type { ProfileAccount } from '@/types/profile';
import type { Collection } from '@/types/collection';
import { getDisplayName } from '@/types/profile';
import { useToast } from '@/features/ui/hooks/useToast';
import ProfileCard from '@/components/profile/ProfileCard';
import CollectionsManagement from '@/components/layout/CollectionsManagement';
import CollectionsList from '@/components/layout/CollectionsList';

interface ProfileModalProps {
  account: ProfileAccount;
  isOwnProfile: boolean;
  collections?: Collection[];
  onAccountUpdate?: (account: ProfileAccount) => void;
}

export default function ProfileModal({ account: initialAccount, isOwnProfile, collections = [], onAccountUpdate }: ProfileModalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [account, setAccount] = useState<ProfileAccount>(initialAccount);
  const [searchVisibility, setSearchVisibility] = useState<boolean>(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);
  const { success, error: showError } = useToast();

  // Update local state when prop changes
  useEffect(() => {
    setAccount(initialAccount);
  }, [initialAccount]);

  const displayName = getDisplayName(account);

  // Handle expand/collapse animations
  useEffect(() => {
    if (modalRef.current) {
      if (isExpanded) {
        modalRef.current.style.height = '100vh';
      } else {
        modalRef.current.style.height = '70px';
      }
    }
  }, [isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleAccountUpdate = (updatedAccount: ProfileAccount) => {
    setAccount(updatedAccount);
    onAccountUpdate?.(updatedAccount);
  };

  // Fetch search visibility
  useEffect(() => {
    const fetchSearchVisibility = async () => {
      if (!account?.id) return;
      
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('accounts')
          .select('search_visibility')
          .eq('id', account.id)
          .single();
        
        if (!error && data) {
          setSearchVisibility(data.search_visibility || false);
        }
      } catch (error) {
        console.error('[ProfileModal] Error fetching search visibility:', error);
      }
    };
    
    if (account?.id) {
      fetchSearchVisibility();
    }
  }, [account?.id]);

  // Toggle search visibility
  const handleToggleSearchVisibility = async () => {
    if (!account?.id || isUpdatingVisibility) return;
    
    setIsUpdatingVisibility(true);
    const newValue = !searchVisibility;
    
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('accounts')
        .update({ search_visibility: newValue })
        .eq('id', account.id);
      
      if (!error) {
        setSearchVisibility(newValue);
      } else {
        console.error('[ProfileModal] Error updating search visibility:', error);
      }
    } catch (error) {
      console.error('[ProfileModal] Error updating search visibility:', error);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleSaveTraits = async (traits: string[]) => {
    if (!account?.id) return;
    
    const { supabase } = await import('@/lib/supabase');
    const { error } = await supabase
      .from('accounts')
      .update({ traits })
      .eq('id', account.id);
    
    if (error) {
      console.error('[ProfileModal] Error updating traits:', error);
      throw error;
    }
    // Update local state
    setAccount({ ...account, traits });
    handleAccountUpdate({ ...account, traits });
  };

  const handleSaveBio = async (bio: string) => {
    if (!account?.id) return;
    
    const { supabase } = await import('@/lib/supabase');
    const { error } = await supabase
      .from('accounts')
      .update({ bio })
      .eq('id', account.id);
    
    if (error) {
      console.error('[ProfileModal] Error updating bio:', error);
      throw error;
    }
    // Update local state
    setAccount({ ...account, bio });
    handleAccountUpdate({ ...account, bio });
  };

  const handleCoverImageClick = () => {
    if (!isOwnProfile) return;
    // TODO: Implement cover image upload
    alert('Cover image upload coming soon!');
  };

  const handleProfileImageClick = () => {
    if (!isOwnProfile) return;
    // TODO: Implement profile image upload
    alert('Profile image upload coming soon!');
  };

  const handleCollectionClick = (collection: Collection) => {
    // Show toast with collection info
    success(
      `${collection.emoji} ${collection.title}`,
      `${collection.mention_count || 0} ${collection.mention_count === 1 ? 'mention' : 'mentions'}`
    );
    
    // Close the profile modal
    setIsExpanded(false);
    
    // Dispatch event to filter map by collection
    window.dispatchEvent(new CustomEvent('filter-by-collection', {
      detail: { collectionId: collection.id }
    }));
  };

  return (
    <>
      <div
        ref={modalRef}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 bg-white shadow-2xl transition-all duration-300 ease-out rounded-t-3xl overflow-hidden"
        style={{
          height: '70px',
          maxWidth: '600px',
          width: 'calc(100% - 2rem)',
        }}
      >
        {/* Header - Always visible, clickable, fixed 70px height */}
        <button
          ref={headerRef}
          onClick={toggleExpanded}
          className="w-full flex items-center gap-2 px-3 h-[70px] hover:bg-gray-50 transition-colors"
          style={isExpanded ? { borderBottom: '1px solid #e5e7eb' } : undefined}
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
            {account.image_url ? (
              <Image
                src={account.image_url}
                alt={displayName}
                width={32}
                height={32}
                className="w-full h-full object-cover"
                unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
              />
            ) : (
              <UserIcon className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-semibold text-gray-900 truncate">
              {displayName}
            </div>
            {account.username && (
              <div className="text-[10px] text-gray-500 truncate">
                @{account.username}
              </div>
            )}
          </div>
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronUpIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
        </button>

        {/* Expanded State - Profile Information */}
        {isExpanded && (
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 70px)' }}>
            <div className="p-3 space-y-3">
              <ProfileCard
                account={account}
                darkMode={false}
                searchVisibility={searchVisibility}
                isUpdatingVisibility={isUpdatingVisibility}
                onToggleSearchVisibility={isOwnProfile ? handleToggleSearchVisibility : undefined}
                onSaveTraits={isOwnProfile ? handleSaveTraits : undefined}
                onSaveBio={isOwnProfile ? handleSaveBio : undefined}
                onCoverImageClick={isOwnProfile ? handleCoverImageClick : undefined}
                onProfileImageClick={isOwnProfile ? handleProfileImageClick : undefined}
                showViewButton={false}
                showSearchToggle={isOwnProfile}
              />

              {/* Collections - For owner: management, for viewer: list */}
              <div>
                <div className="text-xs font-semibold mb-2 text-gray-900">Collections</div>
                {isOwnProfile ? (
                  <CollectionsManagement />
                ) : (
                  <CollectionsList
                    accountId={account.id!}
                    isOwner={false}
                    darkMode={false}
                    onCollectionClick={handleCollectionClick}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
