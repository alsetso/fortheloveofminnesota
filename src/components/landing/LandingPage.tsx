'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { PaperAirplaneIcon, HeartIcon } from '@heroicons/react/24/solid';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { PencilIcon, XMarkIcon, PlusIcon, EyeIcon, EyeSlashIcon, TrashIcon } from '@heroicons/react/24/outline';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';

export default function LandingPage() {
  const router = useRouter();
  const { openWelcome } = useAppModalContextSafe();
  const { account, user } = useAuthStateSafe();

  const handleGetStarted = () => {
    openWelcome();
  };

  const handleExploreMap = () => {
    router.push('/map/live');
  };

  const handleProfileClick = () => {
    if (account?.username) {
      router.push(`/${account.username}`);
    }
  };

  // Calculate days since joined
  const daysSinceJoined = useMemo(() => {
    if (!account?.created_at) return 0;
    const createdDate = new Date(account.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [account?.created_at]);

  const displayName = account ? AccountService.getDisplayName(account) : '';
  const supabase = useSupabaseClient();
  const isAdmin = account?.role === 'admin';


  // Mention types
  type MentionType = { id: string; emoji: string; name: string; is_active: boolean };
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [editingType, setEditingType] = useState<MentionType | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Scroll container ref for content area
  const scrollContainerRef = useRef<HTMLDivElement>(null);


  // Fetch mention types
  useEffect(() => {
    const fetchMentionTypes = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name, is_active')
          .order('name');
        
        if (error) throw error;
        setMentionTypes((data || []) as MentionType[]);
      } catch (error) {
        console.error('Failed to fetch mention types:', error);
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchMentionTypes();
  }, [supabase]);

  // Handle opening edit modal
  const handleOpenEditModal = (type: MentionType) => {
    setEditingType(type);
    setIsEditModalOpen(true);
  };

  // Handle opening create modal
  const handleOpenCreateModal = () => {
    setEditingType({ id: '', emoji: '', name: '', is_active: true });
    setIsEditModalOpen(true);
  };

  // Handle closing edit modal
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingType(null);
  };

  // Handle saving mention type (create or update)
  const handleSaveMentionType = async (emoji: string, name: string) => {
    if (!editingType) return;
    
    try {
      if (editingType.id) {
        // Update existing
        const { error } = await (supabase as any)
          .from('mention_types')
          .update({ emoji, name })
          .eq('id', editingType.id);
        
        if (error) throw error;
        
        setMentionTypes(prev => prev.map(t => t.id === editingType.id ? { ...t, emoji, name } : t));
      } else {
        // Create new
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .insert({ emoji, name })
          .select()
          .single();
        
        if (error) throw error;
        
        setMentionTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      
      handleCloseEditModal();
    } catch (error) {
      console.error('Failed to save mention type:', error);
      alert('Failed to save mention type');
    }
  };

  // Handle toggling mention type visibility
  const handleToggleVisibility = async (type: MentionType, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isAdmin) return;
    
    try {
      const newIsActive = !type.is_active;
      const { error } = await (supabase as any)
        .from('mention_types')
        .update({ is_active: newIsActive })
        .eq('id', type.id);
      
      if (error) throw error;
      
      setMentionTypes(prev => prev.map(t => 
        t.id === type.id ? { ...t, is_active: newIsActive } : t
      ));
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
      alert('Failed to toggle visibility');
    }
  };

  // Handle deleting mention type
  const handleDeleteMentionType = async () => {
    if (!editingType || !editingType.id) return;
    
    if (!confirm('Are you sure you want to delete this mention type? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { error } = await (supabase as any)
        .from('mention_types')
        .delete()
        .eq('id', editingType.id);
      
      if (error) throw error;
      
      setMentionTypes(prev => prev.filter(t => t.id !== editingType.id));
      handleCloseEditModal();
    } catch (error) {
      console.error('Failed to delete mention type:', error);
      alert('Failed to delete mention type');
    }
  };

  return (
    <PageWrapper
      headerContent={null}
      searchComponent={<MapSearchInput onLocationSelect={() => {}} />}
      accountDropdownProps={{
        onAccountClick: () => {
          if (account?.username) {
            router.push(`/${account.username}`);
          }
        },
        onSignInClick: handleGetStarted,
      }}
      searchResultsComponent={<SearchResults />}
    >
      {/* Scroll Container - Handles scrolling inside the content area */}
      <div 
        ref={scrollContainerRef}
        className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide"
      >
          <div className="bg-white">
            {/* Hero Content */}
            <div className="flex flex-col items-center justify-center px-6 py-12 space-y-6">
            {/* Main Heading */}
            <div className="text-center space-y-3 max-w-md">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
                <span className="text-lg sm:text-xl font-normal text-gray-500 block mb-1">
                  Share what you love.
                </span>
                Discover what Minnesotans do.
              </h1>
              <p className="text-base sm:text-lg font-medium text-gray-700 leading-relaxed">
                A social map of Minnesota built from real places, real moments, and real recommendations — not algorithms.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="w-full max-w-sm space-y-2.5 pt-2" style={{ pointerEvents: 'auto' }}>
              {user && account ? (
                <button
                  onClick={handleProfileClick}
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 font-medium py-3.5 px-6 rounded-xl border border-gray-200 transition-all active:scale-[0.98] hover:shadow-sm flex items-center gap-3"
                >
                  <ProfilePhoto account={account} size="sm" className="flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {displayName || 'Your Profile'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {daysSinceJoined === 0 
                        ? 'Joined today' 
                        : daysSinceJoined === 1 
                        ? 'Joined yesterday'
                        : `${daysSinceJoined} days ago`
                      }
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                    <PaperAirplaneIcon className="w-4 h-4 text-white" />
                  </div>
                </button>
              ) : (
                <button
                  onClick={handleGetStarted}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-sm active:scale-[0.98] hover:shadow-md"
                >
                  Get Started
                </button>
              )}
              <button
                onClick={handleExploreMap}
                className={`w-full font-medium py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] ${
                  user && account
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md'
                    : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 hover:shadow-sm'
                }`}
              >
                Explore Map
              </button>
              {user && account && (
                <Link
                  href="/settings"
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 font-medium py-3.5 px-6 rounded-xl border border-gray-200 transition-all active:scale-[0.98] hover:shadow-sm flex items-center justify-center"
                >
                  Manage Account
                </Link>
              )}
              {user && account && (
                <Link
                  href="/map/live#contribute"
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 font-medium py-3.5 px-6 rounded-xl border border-gray-200 transition-all active:scale-[0.98] hover:shadow-sm flex items-center justify-center"
                >
                  Add To Map
                </Link>
              )}
            </div>

          </div>

          {/* About Section - Horizontal scrolling iOS-style cards - Hidden if user is logged in */}
          {!user && (
          <div className="relative z-10 bg-white py-6 w-full overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide px-6" style={{ width: '100%', maxWidth: '100vw' }}>
              <div className="flex gap-3 pb-2" style={{ width: 'max-content' }}>
                {/* The Core Idea */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-white rounded-2xl border border-gray-200 p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-gray-900 leading-relaxed">
                    <p className="font-bold text-gray-900">
                      What's loved deserves visibility.
                    </p>
                    <p className="text-gray-700">
                      A map built from real places that matter to real people. Not what's trending. Not what's viral. Just what's true. Only genuine appreciation, made visible.
                    </p>
                  </div>
                </div>

                {/* How It Works */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-white rounded-2xl border border-gray-200 p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-gray-900 leading-relaxed">
                    <p className="font-bold text-gray-900">
                      How It Works
                    </p>
                    <p className="text-gray-700">
                      Find a place in Minnesota that means something to you. Mark it. Tell us why. That's it. No likes. No followers. No feed. Just a map that grows more honest with every pin. Minnesota reveals itself through the places people actually return to.
                    </p>
                  </div>
                </div>

                {/* Why This Feels Different */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-white rounded-2xl border border-gray-200 p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-gray-900 leading-relaxed">
                    <p className="font-bold text-gray-900">
                      Why This Feels Different
                    </p>
                    <p className="text-gray-700">
                      Other platforms reward what gets attention. This one rewards what gets returned to. No feed to scroll. No metrics to chase. No persona to maintain. Just places and why they matter. What surfaces here does so because people keep coming back — not because it went viral.
                    </p>
                  </div>
                </div>

                {/* Built for Minnesotans */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-white rounded-2xl border border-gray-200 p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-gray-900 leading-relaxed">
                    <p className="font-bold text-gray-900">
                      Built for Minnesotans
                    </p>
                    <p className="text-gray-700">
                      Made by people who live here. For people who live here. Simple enough to use today. Deep enough to grow with over time. Every feature, every decision, every change — shaped by the community that shows up. This isn't about building an audience. It's about building a map.
                    </p>
                  </div>
                </div>

                {/* What This Becomes */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-white rounded-2xl border border-gray-200 p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-gray-900 leading-relaxed">
                    <p className="font-bold text-gray-900">
                      What This Becomes
                    </p>
                    <p className="text-gray-700">
                      A collective memory of Minnesota. A guide written by people who've actually been there. A map that shows what matters, not what's marketed. When enough people mark what they love, the map becomes honest. And honesty is the best guide.
                    </p>
                  </div>
                </div>

                {/* Coming to iOS */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-white rounded-2xl border border-gray-200 p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-gray-900 leading-relaxed">
                    <p className="font-bold text-gray-900">
                      Coming to iOS
                    </p>
                    <p className="text-gray-700">
                      The app is in development. Coming soon to your phone. Right now, you're not just early — you're helping shape what this becomes. Every message matters. Every suggestion is read. We're building this together.
                    </p>
                  </div>
                </div>

                {/* Start With What You Love */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-white rounded-2xl border border-gray-200 p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-gray-900 leading-relaxed">
                    <p className="font-bold text-gray-900">
                      Start With What You Love
                    </p>
                    <p className="text-gray-700">
                      That spot you always take visitors. The place you think about when you're away. The corner of Minnesota that feels like home. If it matters to you, it belongs on the map. Put it there.
                    </p>
                  </div>
                </div>

                {/* Contact */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-white rounded-2xl border border-gray-200 p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-gray-900 leading-relaxed">
                    <p className="font-bold text-gray-900">
                      Contact
                    </p>
                    <p className="text-gray-700">
                      <a 
                        href="mailto:loveofminnesota@gmail.com" 
                        className="text-red-600 hover:text-red-700 underline font-bold"
                      >
                        Contact us
                      </a>
                      {' '}at{' '}
                      <a 
                        href="mailto:loveofminnesota@gmail.com" 
                        className="text-red-600 hover:text-red-700 underline"
                      >
                        loveofminnesota@gmail.com
                      </a>
                      {' '}for business inquiries and customer support.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Categories Section - Wrapped grid */}
          <div className="relative z-10 bg-white py-8 w-full rounded-b-3xl">
            <div className="max-w-[1200px] mx-auto px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">All of the things you can post</h2>
                {isAdmin && (
                  <div 
                    onClick={handleOpenCreateModal}
                    className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                    title="Add new mention type"
                  >
                    <PlusIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-blue-600 font-medium">Add Type</span>
                  </div>
                )}
              </div>
              {loadingTypes ? (
                <div className="text-center text-gray-500 py-8">Loading categories...</div>
              ) : (
              <>
                {/* Active Cards Group */}
                {(() => {
                  const activeTypes = mentionTypes.filter(type => type.is_active);
                  const inactiveTypes = mentionTypes.filter(type => !type.is_active);
                  
                  // Helper function to render a card
                  const renderCard = (type: MentionType) => {
                    // Convert name to URL-friendly format
                    const typeSlug = mentionTypeNameToSlug(type.name);
                    return (
                      <div 
                        key={type.id} 
                        className={`rounded-md border border-gray-200 p-3 flex items-center gap-2 transition-colors relative group cursor-pointer ${
                          type.is_active 
                            ? 'bg-white hover:bg-gray-50' 
                            : 'bg-gray-100 opacity-60'
                        }`}
                        onClick={(e) => {
                          // Don't navigate if clicking the edit or eye icon
                          if ((e.target as HTMLElement).closest('svg')) return;
                          router.push(`/map/live?type=${typeSlug}`);
                        }}
                      >
                        <span className="text-xl">{type.emoji}</span>
                        <span className={`text-xs font-medium flex-1 ${
                          type.is_active ? 'text-gray-700' : 'text-gray-500'
                        }`}>{type.name}</span>
                        {isAdmin && (
                          <>
                            {type.is_active ? (
                              <EyeIcon 
                                onClick={(e) => handleToggleVisibility(type, e)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 text-gray-500 cursor-pointer hover:text-gray-700"
                                title="Hide from public"
                              />
                            ) : (
                              <EyeSlashIcon 
                                onClick={(e) => handleToggleVisibility(type, e)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 text-gray-500 cursor-pointer hover:text-gray-700"
                                title="Show to public"
                              />
                            )}
                            <PencilIcon 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(type);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 text-gray-500 cursor-pointer hover:text-gray-700"
                              title="Edit"
                            />
                          </>
                        )}
                      </div>
                    );
                  };
                  
                  return (
                    <>
                      {activeTypes.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {activeTypes.map(renderCard)}
                        </div>
                      )}
                      {isAdmin && inactiveTypes.length > 0 && (
                        <div className="mt-6">
                          <h3 className="text-sm font-medium text-gray-500 mb-3">Inactive</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {inactiveTypes.map(renderCard)}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
              )}
            </div>
          </div>

          {/* After You Post Section - only when authenticated */}
          {user && account && (
          <div className="relative z-10 bg-white py-8 w-full">
            <div className="max-w-[1200px] mx-auto px-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">After you post</h2>
              <p className="text-xs text-gray-600 mb-6">
                Your posts are available in all time filters. View them by 24 hours, 7 days (default), or all time.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 24 Hours Card */}
                <div className="bg-white rounded-md border border-gray-200 p-6 flex flex-col gap-3 hover:bg-gray-50 transition-colors">
                  <h3 className="text-sm font-semibold text-gray-900">24 Hours</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Your posts appear in the 24-hour feed. See the freshest content from your community.
                  </p>
                </div>

                {/* 7 Days Card - Default */}
                <div className="bg-white rounded-md border-2 border-gray-900 p-6 flex flex-col gap-3 hover:bg-gray-50 transition-colors relative">
                  <div className="absolute top-2 right-2">
                    <span className="text-xs font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded">Default</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">7 Days</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Your posts appear in the 7-day feed. This is the default view for browsing mentions.
                  </p>
                </div>

                {/* All Time Card - Contributor Only */}
                <div className={`rounded-md border border-gray-200 p-6 flex flex-col gap-3 transition-colors ${
                  (account?.plan === 'contributor' || account?.plan === 'plus') 
                    ? 'bg-white hover:bg-gray-50' 
                    : 'bg-gray-50 opacity-75'
                }`}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">All Time</h3>
                    {(account?.plan !== 'contributor' && account?.plan !== 'plus') && (
                      <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Contributor</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {(account?.plan === 'contributor' || account?.plan === 'plus') ? (
                      <>Your posts appear in the all-time feed. Access complete history of all mentions.</>
                    ) : (
                      <>All-time view is available for Contributor members. You can still view any user's all-time posts by visiting their profile.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
          )}
          </div>
        </div>

      {/* Edit Mention Type Modal */}
      {isEditModalOpen && editingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4 p-[10px] space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-900">
                {editingType?.id ? 'Edit Mention Type' : 'Create Mention Type'}
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const emoji = formData.get('emoji') as string;
                const name = formData.get('name') as string;
                handleSaveMentionType(emoji, name);
              }} 
              className="space-y-2"
            >
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Emoji
                </label>
                <input
                  type="text"
                  name="emoji"
                  defaultValue={editingType.emoji}
                  className="w-full px-2 py-1.5 text-xl border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
                  maxLength={2}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingType.name}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-2 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="flex-1 px-2 py-1.5 text-xs font-medium bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {editingType?.id && (
                  <button
                    type="button"
                    onClick={handleDeleteMentionType}
                    className="w-full px-2 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <TrashIcon className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
