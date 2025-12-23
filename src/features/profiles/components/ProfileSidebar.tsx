'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  MagnifyingGlassIcon, 
  UserIcon,
  MapPinIcon,
  CalendarIcon,
  LockClosedIcon,
  ShareIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  EnvelopeIcon,
  PhoneIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';
import type { 
  ProfilePin, 
  ProfileAccount,
} from '@/types/profile';
import { 
  TRAIT_OPTIONS, 
  getDisplayName,
  formatJoinDate,
  formatPinDate,
  countPinsByVisibility,
} from '@/types/profile';

interface ProfileSidebarProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  isOpen?: boolean;
  pins: ProfilePin[];
  account: ProfileAccount;
  isOwnProfile: boolean;
  isGuest: boolean;
  onPinSelect?: (pin: ProfilePin) => void;
  onAccountUpdate?: (updates: Partial<ProfileAccount>) => void;
  variant?: 'sidebar' | 'dropdown';
}

export default function ProfileSidebar({
  map,
  mapLoaded,
  isOpen = true,
  pins,
  account,
  isOwnProfile,
  isGuest,
  onPinSelect,
  onAccountUpdate,
  variant = 'sidebar',
}: ProfileSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPins, setFilteredPins] = useState<ProfilePin[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTraitPicker, setShowTraitPicker] = useState(false);
  const [localAccount, setLocalAccount] = useState(account);

  // Sync localAccount with prop changes
  useEffect(() => {
    setLocalAccount(account);
  }, [account]);

  // Use shared utility functions
  const displayName = getDisplayName(localAccount);
  const joinDate = formatJoinDate(localAccount.created_at);
  const { public: publicPinsCount, private: privatePinsCount, total: totalPins } = countPinsByVisibility(pins);

  // Filter pins based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPins([]);
      setShowResults(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = pins.filter(pin => 
      pin.description?.toLowerCase().includes(query)
    );
    setFilteredPins(results);
    setShowResults(true);
  }, [searchQuery, pins]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current && 
        !resultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePinClick = (pin: ProfilePin) => {
    if (!map || !mapLoaded) return;

    map.flyTo({
      center: [pin.lng, pin.lat],
      zoom: 15,
      duration: 1500,
    });

    onPinSelect?.(pin);
    setShowResults(false);
    setSearchQuery('');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/profile/${localAccount.username}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName}'s Profile`,
          text: `Check out ${displayName}'s pins - For the Love of Minnesota`,
          url,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('Profile link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  // Use shared formatPinDate utility
  const formatDate = formatPinDate;

  // Start editing a field
  const startEditing = (field: string, currentValue: string | null) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Save field
  const saveField = async (field: string) => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ [field]: editValue.trim() || null })
        .eq('id', localAccount.id);

      if (error) throw error;

      setLocalAccount(prev => ({ ...prev, [field]: editValue.trim() || null }));
      onAccountUpdate?.({ [field]: editValue.trim() || null });
      setEditingField(null);
      setEditValue('');
    } catch (err) {
      console.error(`Error updating ${field}:`, err);
      alert(`Failed to update ${field}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle trait
  const toggleTrait = async (traitId: string) => {
    const currentTraits = localAccount.traits || [];
    const newTraits = currentTraits.includes(traitId)
      ? currentTraits.filter(t => t !== traitId)
      : [...currentTraits, traitId];

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ traits: newTraits.length > 0 ? newTraits : null })
        .eq('id', localAccount.id);

      if (error) throw error;

      setLocalAccount(prev => ({ ...prev, traits: newTraits.length > 0 ? newTraits : null }));
      onAccountUpdate?.({ traits: newTraits.length > 0 ? newTraits : null });
    } catch (err) {
      console.error('Error updating traits:', err);
    }
  };

  // Handle profile photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB');
      return;
    }

    setIsSaving(true);

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileName = `${localAccount.id}/profile/${timestamp}-${random}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      
      if (!urlData?.publicUrl) throw new Error('Failed to get image URL');

      const { error: updateError } = await supabase
        .from('accounts')
        .update({ image_url: urlData.publicUrl })
        .eq('id', localAccount.id);

      if (updateError) throw updateError;

      setLocalAccount(prev => ({ ...prev, image_url: urlData.publicUrl }));
      onAccountUpdate?.({ image_url: urlData.publicUrl });
    } catch (err) {
      console.error('Error uploading photo:', err);
      alert('Failed to upload photo');
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  const containerClass = variant === 'dropdown' 
    ? 'w-full'
    : 'fixed top-4 left-4 z-40 w-[300px] max-w-[calc(100vw-2rem)]';

  const containerStyle = variant === 'dropdown' 
    ? { pointerEvents: 'auto' as const }
    : { pointerEvents: 'none' as const };

  return (
    <div 
      className={containerClass}
      style={containerStyle}
    >
      <div 
        className={`bg-white ${variant === 'dropdown' ? 'rounded-md' : 'rounded-lg'} border border-gray-200 ${variant === 'dropdown' ? 'shadow-lg' : 'shadow-sm'} overflow-hidden max-h-[calc(100vh-2rem)] overflow-y-auto`}
        style={variant === 'dropdown' ? { pointerEvents: 'auto' } : { pointerEvents: 'auto' }}
      >
        {/* Search Header */}
        <div className="relative flex items-center border-b border-gray-100 sticky top-0 bg-white z-10">
          <Link
            href="/"
            className="group relative flex items-center justify-center w-11 h-11 hover:bg-gray-50 transition-colors"
            title="Go to Community"
          >
            <Image
              src="/logo.png"
              alt="For the Love of Minnesota"
              width={24}
              height={24}
              className="object-contain transition-opacity duration-150 group-hover:opacity-0"
            />
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 absolute opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          </Link>

          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${localAccount.username ? `@${localAccount.username}'s` : ''} pins...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowResults(true)}
              className="w-full h-11 pl-3 pr-10 text-xs bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-gray-400"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Search Results */}
        {showResults && (
          <div ref={resultsRef} className="border-b border-gray-100 max-h-[200px] overflow-y-auto">
            {filteredPins.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-500 text-center">
                No pins found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="py-1">
                {filteredPins.map((pin) => (
                  <button
                    key={pin.id}
                    onClick={() => handlePinClick(pin)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-900 line-clamp-1">{pin.description || 'Unnamed pin'}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500">{formatDate(pin.created_at)}</span>
                          {pin.visibility === 'only_me' && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">Private</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Card */}
        <div className="relative">
          {/* Header with gradient */}
          <div className="relative h-16 bg-gradient-to-r from-gray-800 to-gray-900">
            {/* Profile Photo */}
            <div className="absolute -bottom-6 left-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={!isOwnProfile || isSaving}
              />
              <button
                onClick={() => isOwnProfile && fileInputRef.current?.click()}
                disabled={!isOwnProfile || isSaving}
                className={`w-12 h-12 rounded-full bg-white border-2 border-white shadow-md overflow-hidden ${
                  isOwnProfile ? 'cursor-pointer group' : ''
                }`}
              >
                {localAccount.image_url ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={localAccount.image_url}
                      alt={displayName}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                      unoptimized={localAccount.image_url.startsWith('data:') || localAccount.image_url.includes('supabase.co')}
                    />
                    {isOwnProfile && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <CameraIcon className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    {isOwnProfile ? (
                      <CameraIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                )}
              </button>
            </div>
            
            {/* Guest Badge */}
            {isGuest && (
              <div className="absolute top-1.5 right-2">
                <span className="px-1.5 py-0.5 bg-gray-700/80 text-white text-[9px] font-medium rounded">Guest</span>
              </div>
            )}

            {/* View Count */}
            {localAccount.view_count > 0 && (
              <div className="absolute bottom-1.5 right-2 flex items-center gap-1 text-white/80 text-[9px]">
                <EyeIcon className="w-3 h-3" />
                <span>{localAccount.view_count}</span>
              </div>
            )}
          </div>

          {/* Profile Content */}
          <div className="pt-8 pb-3 px-3 space-y-3">
            {/* Name and username */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900 leading-tight">{displayName}</h2>
              {localAccount.username && (
                <p className="text-[10px] text-gray-500">@{localAccount.username}</p>
              )}
            </div>

            {/* Bio Section - Only show for own profile or if bio exists */}
            {(isOwnProfile || localAccount.bio) && (
              <div>
                {editingField === 'bio' ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value.slice(0, 220))}
                      placeholder="Write a short bio..."
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-gray-900"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">{editValue.length}/220</span>
                      <div className="flex gap-1">
                        <button onClick={cancelEditing} className="p-1 text-gray-400 hover:text-gray-600">
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => saveField('bio')} disabled={isSaving} className="p-1 text-gray-600 hover:text-gray-900">
                          <CheckIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="group">
                    {localAccount.bio ? (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {localAccount.bio}
                        {isOwnProfile && (
                          <button onClick={() => startEditing('bio', localAccount.bio)} className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600">
                            <PencilSquareIcon className="w-3 h-3 inline" />
                          </button>
                        )}
                      </p>
                    ) : isOwnProfile ? (
                      <button onClick={() => startEditing('bio', null)} className="text-xs text-gray-400 hover:text-gray-600">
                        + Add bio
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-3 text-[10px] text-gray-600">
              <div className="flex items-center gap-1">
                <MapPinIcon className="w-3 h-3 text-gray-400" />
                <span>{publicPinsCount} public</span>
              </div>
              {isOwnProfile && privatePinsCount > 0 && (
                <div className="flex items-center gap-1">
                  <LockClosedIcon className="w-3 h-3 text-gray-400" />
                  <span>{privatePinsCount} private</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3 text-gray-400" />
                <span>{joinDate}</span>
              </div>
            </div>

            {/* Contact Info - Only for own profile */}
            {isOwnProfile && (
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                {/* Email */}
                <div className="group flex items-center gap-2">
                  <EnvelopeIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  {editingField === 'email' ? (
                    <div className="flex-1 flex items-center gap-1">
                      <input
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="email@example.com"
                        className="flex-1 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                        autoFocus
                      />
                      <button onClick={cancelEditing} className="p-0.5 text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                      <button onClick={() => saveField('email')} disabled={isSaving} className="p-0.5 text-gray-600 hover:text-gray-900">
                        <CheckIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ) : localAccount.email ? (
                    <span className="text-[10px] text-gray-600 flex-1">
                      {localAccount.email}
                      <button onClick={() => startEditing('email', localAccount.email)} className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600">
                        <PencilSquareIcon className="w-2.5 h-2.5 inline" />
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => startEditing('email', null)} className="text-[10px] text-gray-400 hover:text-gray-600">
                      + Add email
                    </button>
                  )}
                </div>

                {/* Phone */}
                <div className="group flex items-center gap-2">
                  <PhoneIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  {editingField === 'phone' ? (
                    <div className="flex-1 flex items-center gap-1">
                      <input
                        type="tel"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="flex-1 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                        autoFocus
                      />
                      <button onClick={cancelEditing} className="p-0.5 text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                      <button onClick={() => saveField('phone')} disabled={isSaving} className="p-0.5 text-gray-600 hover:text-gray-900">
                        <CheckIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ) : localAccount.phone ? (
                    <span className="text-[10px] text-gray-600 flex-1">
                      {localAccount.phone}
                      <button onClick={() => startEditing('phone', localAccount.phone)} className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600">
                        <PencilSquareIcon className="w-2.5 h-2.5 inline" />
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => startEditing('phone', null)} className="text-[10px] text-gray-400 hover:text-gray-600">
                      + Add phone
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Traits Section - Only for own profile or if traits exist */}
            {(isOwnProfile || (localAccount.traits && localAccount.traits.length > 0)) && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Interests</span>
                  {isOwnProfile && (
                    <button
                      onClick={() => setShowTraitPicker(!showTraitPicker)}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      {showTraitPicker ? 'Done' : '+ Edit'}
                    </button>
                  )}
                </div>
                
                {showTraitPicker && isOwnProfile ? (
                  <div className="flex flex-wrap gap-1">
                    {TRAIT_OPTIONS.map(trait => {
                      const isSelected = localAccount.traits?.includes(trait.id);
                      return (
                        <button
                          key={trait.id}
                          onClick={() => toggleTrait(trait.id)}
                          className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                            isSelected
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {trait.label}
                        </button>
                      );
                    })}
                  </div>
                ) : localAccount.traits && localAccount.traits.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {localAccount.traits.map(traitId => {
                      const trait = TRAIT_OPTIONS.find(t => t.id === traitId);
                      return trait ? (
                        <span key={traitId} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                          {trait.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                ) : isOwnProfile ? (
                  <button
                    onClick={() => setShowTraitPicker(true)}
                    className="text-[10px] text-gray-400 hover:text-gray-600"
                  >
                    + Add interests
                  </button>
                ) : null}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              {isOwnProfile ? (
                <>
                  <Link
                    href="/?modal=account&tab=onboarding"
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-900 text-white text-[10px] font-medium rounded hover:bg-gray-800 transition-colors"
                  >
                    <PencilSquareIcon className="w-3 h-3" />
                    Full Edit
                  </Link>
                  <button
                    onClick={handleShare}
                    className="flex items-center justify-center px-2 py-1.5 border border-gray-200 text-gray-700 text-[10px] font-medium rounded hover:bg-gray-50 transition-colors"
                    title="Share profile"
                  >
                    <ShareIcon className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-gray-200 text-gray-700 text-[10px] font-medium rounded hover:bg-gray-50 transition-colors"
                >
                  <ShareIcon className="w-3 h-3" />
                  Share Profile
                </button>
              )}
            </div>

            {/* Empty state */}
            {totalPins === 0 && (
              <div className="text-center pt-2">
                <p className="text-[10px] text-gray-500">
                  {isOwnProfile 
                    ? 'Double-click on the map to add your first pin!'
                    : 'No public pins yet.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Debug Badge - Development Only */}
        {isOwnProfile && process.env.NODE_ENV === 'development' && (
          <div className="px-3 py-2 bg-yellow-50 border-t border-yellow-200">
            <div className="text-[9px] font-medium text-yellow-800 uppercase tracking-wide">
              Debug: Your Profile
            </div>
            <div className="text-[10px] text-yellow-700">
              /profile/{localAccount.username || 'unknown'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

