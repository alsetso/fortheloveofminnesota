'use client';

import { useRouter } from 'next/navigation';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { PaperAirplaneIcon, HeartIcon } from '@heroicons/react/24/solid';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { PencilIcon, XMarkIcon, PlusIcon, EyeIcon, EyeSlashIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';

interface LandingPageProps {
  /** When true, render only inner content for use inside NewPageWrapper (no PageWrapper). */
  embedInNewPageWrapper?: boolean;
}

export default function LandingPage({ embedInNewPageWrapper = false }: LandingPageProps = {}) {
  const router = useRouter();
  const { openWelcome } = useAppModalContextSafe();
  const { account, user } = useAuthStateSafe();

  const handleGetStarted = () => {
    openWelcome();
  };

  const handleExploreMap = () => {
    router.push('/maps'); // Maps page shows live map by default
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
  const [inactiveSectionOpen, setInactiveSectionOpen] = useState(true);

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

  const landingContent = (
    <>
      {/* When embedded, NewPageWrapper main is the scroll container; no inner scroll needed */}
      <div ref={scrollContainerRef} className={embedInNewPageWrapper ? '' : 'h-full overflow-y-auto overflow-x-hidden scrollbar-hide'}>
        <div className="bg-surface-muted">
            {/* Hero Content */}
            <div className="flex flex-col items-center justify-center px-6 py-12 space-y-6">
            {/* Main Heading */}
            <div className="text-center space-y-3 max-w-md">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground leading-tight">
                <span className="text-lg sm:text-xl font-normal text-foreground-muted block mb-1">
                  Share what you love.
                </span>
                Discover what Minnesotans do.
              </h1>
              <p className="text-base sm:text-lg font-medium text-foreground-muted leading-relaxed">
                A social map of Minnesota built from real places, real moments, and real recommendations — not algorithms.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="w-full max-w-sm space-y-2.5 pt-2" style={{ pointerEvents: 'auto' }}>
              {user && account ? (
                <button
                  onClick={handleProfileClick}
                  className="w-full bg-surface hover:bg-surface-accent text-foreground font-medium py-3.5 px-6 rounded-xl border border-border transition-all active:scale-[0.98] hover:shadow-sm flex items-center gap-3"
                >
                  <ProfilePhoto account={account} size="sm" className="flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {displayName || 'Your Profile'}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {daysSinceJoined === 0 
                        ? 'Joined today' 
                        : daysSinceJoined === 1 
                        ? 'Joined yesterday'
                        : `${daysSinceJoined} days ago`
                      }
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-8 h-8 bg-foreground rounded-full flex items-center justify-center">
                    <PaperAirplaneIcon className="w-4 h-4 text-surface" />
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
                    : 'bg-surface hover:bg-surface-accent text-foreground border border-border hover:shadow-sm'
                }`}
              >
                Explore Map
              </button>
            </div>

          </div>

          {/* About Section - Horizontal scrolling iOS-style cards - Hidden if user is logged in */}
          {!user && (
          <div className="relative z-10 bg-surface-muted py-6 w-full overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide px-6" style={{ width: '100%', maxWidth: '100vw' }}>
              <div className="flex gap-3 pb-2" style={{ width: 'max-content' }}>
                {/* The Core Idea */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-surface rounded-2xl border border-border p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-foreground leading-relaxed">
                    <p className="font-bold text-foreground">
                      What's loved deserves visibility.
                    </p>
                    <p className="text-foreground-muted">
                      A map built from real places that matter to real people. Not what's trending. Not what's viral. Just what's true. Only genuine appreciation, made visible.
                    </p>
                  </div>
                </div>

                {/* How It Works */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-surface rounded-2xl border border-border p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-foreground leading-relaxed">
                    <p className="font-bold text-foreground">
                      How It Works
                    </p>
                    <p className="text-foreground-muted">
                      Find a place in Minnesota that means something to you. Mark it. Tell us why. That's it. No likes. No followers. No feed. Just a map that grows more honest with every pin. Minnesota reveals itself through the places people actually return to.
                    </p>
                  </div>
                </div>

                {/* Why This Feels Different */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-surface rounded-2xl border border-border p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-foreground leading-relaxed">
                    <p className="font-bold text-foreground">
                      Why This Feels Different
                    </p>
                    <p className="text-foreground-muted">
                      Other platforms reward what gets attention. This one rewards what gets returned to. No feed to scroll. No metrics to chase. No persona to maintain. Just places and why they matter. What surfaces here does so because people keep coming back — not because it went viral.
                    </p>
                  </div>
                </div>

                {/* Built for Minnesotans */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-surface rounded-2xl border border-border p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-foreground leading-relaxed">
                    <p className="font-bold text-foreground">
                      Built for Minnesotans
                    </p>
                    <p className="text-foreground-muted">
                      Made by people who live here. For people who live here. Simple enough to use today. Deep enough to grow with over time. Every feature, every decision, every change — shaped by the community that shows up. This isn't about building an audience. It's about building a map.
                    </p>
                  </div>
                </div>

                {/* What This Becomes */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-surface rounded-2xl border border-border p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-foreground leading-relaxed">
                    <p className="font-bold text-foreground">
                      What This Becomes
                    </p>
                    <p className="text-foreground-muted">
                      A collective memory of Minnesota. A guide written by people who've actually been there. A map that shows what matters, not what's marketed. When enough people mark what they love, the map becomes honest. And honesty is the best guide.
                    </p>
                  </div>
                </div>

                {/* Coming to iOS */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-surface rounded-2xl border border-border p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-foreground leading-relaxed">
                    <p className="font-bold text-foreground">
                      Coming to iOS
                    </p>
                    <p className="text-foreground-muted">
                      The app is in development. Coming soon to your phone. Right now, you're not just early — you're helping shape what this becomes. Every message matters. Every suggestion is read. We're building this together.
                    </p>
                  </div>
                </div>

                {/* Start With What You Love */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-surface rounded-2xl border border-border p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-foreground leading-relaxed">
                    <p className="font-bold text-foreground">
                      Start With What You Love
                    </p>
                    <p className="text-foreground-muted">
                      That spot you always take visitors. The place you think about when you're away. The corner of Minnesota that feels like home. If it matters to you, it belongs on the map. Put it there.
                    </p>
                  </div>
                </div>

                {/* Contact */}
                <div className="flex-shrink-0 w-[85vw] max-w-[400px] h-[70vh] min-h-[500px] bg-surface rounded-2xl border border-border p-8 flex flex-col shadow-sm relative">
                  <HeartIcon className="w-8 h-8 text-red-600 absolute top-8 right-8" />
                  <div className="flex-1" />
                  <div className="space-y-3 text-lg text-foreground leading-relaxed">
                    <p className="font-bold text-foreground">
                      Contact
                    </p>
                    <p className="text-foreground-muted">
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
          <div className="relative z-10 bg-surface-muted py-8 w-full rounded-b-3xl">
            <div className="max-w-[1200px] mx-auto px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <h2 className="text-2xl font-bold text-foreground">All of the things you can post</h2>
                {isAdmin && (
                  <div 
                    onClick={handleOpenCreateModal}
                    className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                    title="Add new mention type"
                  >
                    <PlusIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Add Type</span>
                  </div>
                )}
              </div>
              {loadingTypes ? (
                <div className="text-center text-foreground-muted py-8">Loading categories...</div>
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
                        className={`rounded-md border border-border p-2 sm:p-3 flex items-center gap-1.5 sm:gap-2 transition-colors relative group cursor-pointer min-w-0 ${
                          type.is_active 
                            ? 'bg-surface hover:bg-surface-accent' 
                            : 'bg-surface-accent opacity-60'
                        }`}
                        onClick={(e) => {
                          // Don't navigate if clicking the edit or eye icon
                          if ((e.target as HTMLElement).closest('svg')) return;
                          router.push(`/maps?type=${typeSlug}`);
                        }}
                      >
                        <span className="text-base sm:text-xl flex-shrink-0">{type.emoji}</span>
                        <span className={`text-xs font-medium flex-1 min-w-0 truncate ${
                          type.is_active ? 'text-foreground' : 'text-foreground-muted'
                        }`}>{type.name}</span>
                        {isAdmin && (
                          <>
                            {type.is_active ? (
                              <EyeIcon 
                                onClick={(e) => handleToggleVisibility(type, e)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 text-foreground-muted cursor-pointer hover:text-foreground"
                                title="Hide from public"
                              />
                            ) : (
                              <EyeSlashIcon 
                                onClick={(e) => handleToggleVisibility(type, e)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 text-foreground-muted cursor-pointer hover:text-foreground"
                                title="Show to public"
                              />
                            )}
                            <PencilIcon 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(type);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 text-foreground-muted cursor-pointer hover:text-foreground"
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
                        <div className="grid gap-2 sm:gap-3 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
                          {activeTypes.map(renderCard)}
                        </div>
                      )}
                      {isAdmin && inactiveTypes.length > 0 && (
                        <div className="mt-6 border border-border rounded-md overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setInactiveSectionOpen((o) => !o)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-foreground-muted hover:bg-surface-accent transition-colors"
                            aria-expanded={inactiveSectionOpen}
                          >
                            <span>Inactive</span>
                            {inactiveSectionOpen ? (
                              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
                            )}
                          </button>
                          {inactiveSectionOpen && (
                            <div className="px-3 pb-3 pt-0">
                              <div className="grid gap-2 sm:gap-3 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
                                {inactiveTypes.map(renderCard)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
              )}
            </div>
          </div>

          </div>
        </div>

      {/* Edit Mention Type Modal */}
      {isEditModalOpen && editingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-md border border-border w-full max-w-md mx-4 p-[10px] space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-foreground">
                {editingType?.id ? 'Edit Mention Type' : 'Create Mention Type'}
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="text-foreground-muted hover:text-foreground"
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
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  Emoji
                </label>
                <input
                  type="text"
                  name="emoji"
                  defaultValue={editingType.emoji}
                  className="w-full px-2 py-1.5 text-xl bg-surface border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground focus:border-foreground transition-colors text-foreground"
                  maxLength={2}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingType.name}
                  className="w-full px-2 py-1.5 text-xs bg-surface border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground focus:border-foreground transition-colors text-foreground"
                  required
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-2 py-1.5 text-xs font-medium bg-foreground text-surface rounded-md hover:opacity-90 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="flex-1 px-2 py-1.5 text-xs font-medium bg-surface-accent text-foreground rounded-md hover:bg-surface-accent/80 transition-colors border border-border"
                  >
                    Cancel
                  </button>
                </div>
                {editingType?.id && (
                  <button
                    type="button"
                    onClick={handleDeleteMentionType}
                    className="w-full px-2 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors flex items-center justify-center gap-1.5"
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
    </>
  );

  if (embedInNewPageWrapper) {
    return landingContent;
  }

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
      {landingContent}
    </PageWrapper>
  );
}
