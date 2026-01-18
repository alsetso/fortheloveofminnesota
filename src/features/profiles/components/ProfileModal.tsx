'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ChevronUpIcon, ChevronDownIcon, UserIcon, PencilIcon } from '@heroicons/react/24/outline';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import { getDisplayName, formatPinDate } from '@/types/profile';
import { useToast } from '@/features/ui/hooks/useToast';
import ProfileCard from '@/components/profile/ProfileCard';
import CollectionsManagement from '@/components/layout/CollectionsManagement';
import CollectionsList from '@/components/layout/CollectionsList';
import { MentionService } from '@/features/mentions/services/mentionService';
import { useAuthStateSafe } from '@/features/auth';
import EditMentionModal from '@/components/modals/EditMentionModal';
import ImagePreviewContainer from '@/components/modals/ImagePreviewContainer';
import LikeButton from '@/components/mentions/LikeButton';

interface ProfileModalProps {
  account: ProfileAccount;
  isOwnProfile: boolean;
  collections?: Collection[];
  pins?: ProfilePin[];
  onAccountUpdate?: (account: ProfileAccount) => void;
}

export default function ProfileModal({ account: initialAccount, isOwnProfile, collections = [], pins: initialPins, onAccountUpdate }: ProfileModalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [account, setAccount] = useState<ProfileAccount>(initialAccount);
  const [searchVisibility, setSearchVisibility] = useState<boolean>(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [pins, setPins] = useState<ProfilePin[]>(initialPins || []);
  const [loadingPins, setLoadingPins] = useState(false);
  const [editingMentionId, setEditingMentionId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);
  const { account: currentAccount } = useAuthStateSafe();
  const { success, error: showError } = useToast();

  // Update local state when prop changes
  useEffect(() => {
    setAccount(initialAccount);
  }, [initialAccount]);

  // Fetch mentions if not provided
  useEffect(() => {
    if (!initialPins && account?.id && isExpanded) {
      fetchMentions();
    } else if (initialPins) {
      setPins(initialPins);
    }
  }, [account?.id, isExpanded, initialPins]);

  const fetchMentions = async () => {
    if (!account?.id) return;
    
    setLoadingPins(true);
    try {
      const mentions = await MentionService.getMentions({ account_id: account.id });
      // Convert to ProfilePin format
      const profilePins: ProfilePin[] = mentions.map(m => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        description: m.description,
        collection_id: m.collection_id,
        visibility: m.visibility,
        image_url: m.image_url || null,
        video_url: m.video_url || null,
        media_type: m.media_type || 'none',
        created_at: m.created_at,
        updated_at: m.updated_at,
      }));
      setPins(profilePins);
    } catch (error) {
      console.error('[ProfileModal] Error fetching mentions:', error);
    } finally {
      setLoadingPins(false);
    }
  };

  const handleEditMention = (mentionId: string) => {
    if (!isOwnProfile) return;
    setEditingMentionId(mentionId);
  };

  const handleMentionUpdated = () => {
    // Refresh mentions after update
    if (account?.id) {
      fetchMentions();
    }
  };

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

              {/* Mentions List - Compact list with edit */}
              <div>
                <div className="text-xs font-semibold mb-2 text-gray-900">Mentions</div>
                {loadingPins ? (
                  <div className="text-xs text-gray-500 py-2">Loading mentions...</div>
                ) : pins.length === 0 ? (
                  <div className="text-xs text-gray-500 py-2">No mentions yet</div>
                ) : (
                  <div className="space-y-0.5">
                    {pins
                      .filter(pin => isOwnProfile || pin.visibility === 'public')
                      .map((pin, index) => {
                        const collection = collections.find(c => c.id === pin.collection_id);
                        return (
                          <div key={pin.id} className="flex items-start gap-2 p-1.5 hover:bg-gray-50 rounded-md transition-colors">
                            {/* Circle indicator */}
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0 mt-1.5" />
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                {collection && (
                                  <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {collection.emoji} {collection.title}
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-500">
                                  {formatPinDate(pin.created_at)}
                                </span>
                              </div>
                              {pin.description && (
                                <p className="text-xs text-gray-700 break-words mt-0.5">
                                  {pin.description}
                                </p>
                              )}
                              {/* Image if uploaded - Compact and clickable */}
                              {pin.image_url && pin.media_type === 'image' && (
                                <button
                                  onClick={() => setPreviewImageUrl(pin.image_url || null)}
                                  className="mt-1.5 w-full rounded-md overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
                                >
                                  <div className="relative w-full h-20 bg-gray-100">
                                    <Image
                                      src={pin.image_url}
                                      alt={pin.description || 'Mention image'}
                                      fill
                                      className="object-contain"
                                      unoptimized={pin.image_url.startsWith('data:') || pin.image_url.includes('supabase.co')}
                                    />
                                  </div>
                                </button>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Like Button - Show for all authenticated users */}
                              {currentAccount && (
                                <LikeButton
                                  mentionId={pin.id}
                                  initialLiked={pin.is_liked || false}
                                  initialCount={pin.likes_count || 0}
                                  size="sm"
                                  showCount={true}
                                />
                              )}
                              {/* Edit Icon - Only for own profile */}
                              {isOwnProfile && (
                                <button
                                  onClick={() => handleEditMention(pin.id)}
                                  className="p-1 text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0"
                                  aria-label="Edit mention"
                                >
                                  <PencilIcon className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Mention Modal */}
      <EditMentionModal
        isOpen={editingMentionId !== null}
        onClose={() => setEditingMentionId(null)}
        mentionId={editingMentionId}
        onMentionUpdated={handleMentionUpdated}
      />

      {/* Image Preview Container */}
      <ImagePreviewContainer
        isOpen={previewImageUrl !== null}
        onClose={() => setPreviewImageUrl(null)}
        imageUrl={previewImageUrl || ''}
        alt="Mention image"
      />
    </>
  );
}
