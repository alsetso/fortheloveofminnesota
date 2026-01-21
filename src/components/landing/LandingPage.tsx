'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { PaperAirplaneIcon, HeartIcon } from '@heroicons/react/24/solid';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useIOSStandalone } from '@/hooks/useIOSStandalone';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { PencilIcon, XMarkIcon, PlusIcon, EyeIcon, EyeSlashIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function LandingPage() {
  const router = useRouter();
  const { openWelcome } = useAppModalContextSafe();
  const { account, user } = useAuthStateSafe();

  const handleGetStarted = () => {
    openWelcome();
  };

  const handleExploreMap = () => {
    router.push('/live');
  };

  const handleProfileClick = () => {
    if (account?.username) {
      router.push(`/profile/${account.username}`);
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
  const isIOSStandalone = useIOSStandalone();
  const supabase = useSupabaseClient();
  const isAdmin = account?.role === 'admin';

  // Homepage visit stats
  const [visitStats, setVisitStats] = useState<{ last24Hours: number; previous24Hours: number; total: number } | null>(null);
  const [showTotal, setShowTotal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Mention types
  type MentionType = { id: string; emoji: string; name: string; is_active: boolean };
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [editingType, setEditingType] = useState<MentionType | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Scroll tracking for white container overlay effect
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const whiteContentRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [footerRevealed, setFooterRevealed] = useState(false);

  // Calculate if trending (volume + growth)
  const isTrending = useMemo(() => {
    if (!visitStats) return false;
    const { last24Hours, previous24Hours } = visitStats;
    
    // Minimum volume threshold: 30+ visits
    if (last24Hours < 30) return false;
    
    // If no previous data, any volume >= 30 is trending
    if (previous24Hours === 0) return true;
    
    // Calculate growth percentage
    const growth = ((last24Hours - previous24Hours) / previous24Hours) * 100;
    
    // Trending if 20%+ growth
    return growth >= 20;
  }, [visitStats]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/analytics/homepage-stats');
        if (response.ok) {
          const data = await response.json();
          setVisitStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch homepage stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

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

  // Track scroll position for white container overlay effect
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      const maxScroll = scrollHeight - clientHeight;
      
      // Calculate progress (0 to 1) - when we reach bottom, progress = 1
      const progress = maxScroll > 0 ? Math.min(scrollTop / maxScroll, 1) : 0;
      
      // Use hysteresis to prevent flickering: reveal at 0.85, hide at 0.80
      setFooterRevealed(prev => {
        if (progress >= 0.85) return true;
        if (progress < 0.80) return false;
        return prev; // Keep current state when between thresholds
      });
      
      setScrollProgress(progress);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Viewport height constants
  const HEADER_HEIGHT_VH = 10; // 10vh
  const FOOTER_HEIGHT_VH = 10; // 10vh
  const MAIN_CONTENT_HEIGHT_VH = 90; // 90vh initially
  const MAIN_CONTENT_HEIGHT_WITH_FOOTER_VH = 80; // 80vh when footer is revealed

  // Calculate header height in pixels for transform
  const headerHeightPx = typeof window !== 'undefined' ? window.innerHeight * (HEADER_HEIGHT_VH / 100) : 130;

  // Main content height based on footer visibility (using state with hysteresis to prevent flickering)
  const mainContentHeight = footerRevealed 
    ? MAIN_CONTENT_HEIGHT_WITH_FOOTER_VH 
    : MAIN_CONTENT_HEIGHT_VH;

  return (
    <div className="relative w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Homepage Screen Container - 100vh fixed height */}
      <div 
        className="h-screen w-full flex flex-col overflow-hidden" 
        style={{ 
          backgroundColor: '#000000', 
          maxWidth: '100vw',
          height: '100vh',
          minHeight: '100vh',
          maxHeight: '100vh'
        }}
      >
        {/* Header - Sticky to top, 10vh */}
        <header 
          className="sticky top-0 z-10 px-6 flex items-end justify-between flex-shrink-0" 
          style={{ 
            backgroundColor: '#000000',
            paddingTop: '20px',
            paddingBottom: '20px',
            height: `${HEADER_HEIGHT_VH}vh`,
            minHeight: `${HEADER_HEIGHT_VH}vh`,
            maxHeight: `${HEADER_HEIGHT_VH}vh`
          }}
        >
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image
                src="/white-logo.png"
                alt="For the Love of Minnesota"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="text-white font-semibold text-sm">For the Love of Minnesota</span>
          </div>
          <div className="flex items-center gap-3">
            {user && account ? (
              <>
                <Link
                  href="/plans"
                  className="text-white text-sm font-medium hover:text-gray-300 transition-colors flex items-center"
                >
                  Plans
                </Link>
                <button onClick={handleProfileClick} className="flex items-center justify-center">
                  <ProfilePhoto account={account} size="sm" />
                </button>
              </>
            ) : (
              <button
                onClick={handleGetStarted}
                className="text-white text-sm font-medium hover:text-gray-300 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area - Sticky, 90vh initially, 80vh when footer revealed */}
        <div 
          className="relative overflow-visible flex-shrink-0" 
          style={{ 
            height: `${mainContentHeight}vh`,
            minHeight: `${mainContentHeight}vh`,
            maxHeight: `${mainContentHeight}vh`,
            transition: 'height 0.2s ease-out',
            backgroundColor: '#000000'
          }}
        >
          {/* Wrapper Container - Rounded top corners, moves behind header on scroll */}
          <div 
            ref={whiteContentRef}
            className="bg-white rounded-t-3xl rounded-b-3xl h-full overflow-hidden"
            style={{
              transform: `translateY(-${scrollProgress * headerHeightPx}px)`,
              willChange: 'transform',
              zIndex: 20,
              position: 'relative',
              backgroundColor: '#ffffff'
            }}
          >
            {/* Scroll Container - Handles scrolling inside the wrapper */}
            <div 
              ref={scrollContainerRef}
              className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide rounded-t-3xl" 
              style={{ 
                backgroundColor: 'transparent'
              }}
            >
              <div 
                className="bg-white rounded-b-3xl"
                style={{
                  minHeight: '100%'
                }}
              >
            {/* Hero Content Card - White background with rounded top corners */}
            <div className="min-h-[calc(100vh-130px)] flex flex-col justify-end pb-0">
              <div className="rounded-t-3xl flex flex-col items-center justify-center px-6 py-12 space-y-6">
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
                  href="/add"
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 font-medium py-3.5 px-6 rounded-xl border border-gray-200 transition-all active:scale-[0.98] hover:shadow-sm flex items-center justify-center"
                >
                  Add To Map
                </Link>
              )}
              
              {/* Live Analytics - Below Explore Map Button */}
              {visitStats && (
                <button
                  onClick={() => setShowTotal(!showTotal)}
                  className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center gap-1.5 pt-1"
                >
                  {loading ? (
                    'Loading...'
                  ) : (
                    <>
                      {isTrending && <span>🔥</span>}
                      {showTotal ? (
                        <span>{visitStats.total.toLocaleString()} total visits</span>
                      ) : (
                        <span>{visitStats.last24Hours.toLocaleString()} visits in 24h</span>
                      )}
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Scroll Indicator */}
            <div className="flex flex-col items-center justify-center mt-8 animate-bounce">
              <ChevronDownIcon className="w-6 h-6 text-gray-400" />
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
                          router.push(`/live?type=${typeSlug}`);
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

          {/* After You Post Section */}
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

                {/* All Time Card - Pro Only */}
                <div className={`rounded-md border border-gray-200 p-6 flex flex-col gap-3 transition-colors ${
                  (account?.plan === 'pro' || account?.plan === 'plus') 
                    ? 'bg-white hover:bg-gray-50' 
                    : 'bg-gray-50 opacity-75'
                }`}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">All Time</h3>
                    {(account?.plan !== 'pro' && account?.plan !== 'plus') && (
                      <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Pro</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {(account?.plan === 'pro' || account?.plan === 'plus') ? (
                      <>Your posts appear in the all-time feed. Access complete history of all mentions.</>
                    ) : (
                      <>All-time view is available for Pro members. You can still view any user's all-time posts by visiting their profile.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Sticky to bottom, 10vh, revealed after scrolling */}
          <footer 
            className="sticky bottom-0 z-10 bg-black text-white flex-shrink-0"
            style={{
              backgroundColor: '#000000',
              height: `${FOOTER_HEIGHT_VH}vh`,
              minHeight: `${FOOTER_HEIGHT_VH}vh`,
              maxHeight: `${FOOTER_HEIGHT_VH}vh`,
              width: '100vw',
              left: 0,
              right: 0,
              margin: 0,
              padding: 0,
              opacity: footerRevealed ? Math.min((scrollProgress - 0.80) / 0.20, 1) : 0,
              transition: 'opacity 0.2s ease-out',
              pointerEvents: footerRevealed && scrollProgress > 0.9 ? 'auto' : 'none',
              visibility: footerRevealed ? 'visible' : 'hidden'
            }}
          >
          <div 
            className="h-full flex items-center justify-center"
            style={{
              width: '100%',
              margin: 0,
              padding: 0
            }}
          >
            <div 
              className="flex items-center justify-center gap-4"
              style={{
                width: '100%',
                fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)',
                margin: 0,
                padding: 0,
                lineHeight: '1'
              }}
            >
              <Link
                href="/contact"
                className="text-gray-400 hover:text-white transition-colors flex items-center"
                style={{ lineHeight: '1' }}
              >
                Contact
              </Link>
              <span className="text-gray-600 flex items-center" style={{ lineHeight: '1' }}>•</span>
              <a
                href="mailto:loveofminnesota@gmail.com"
                className="text-gray-400 hover:text-white transition-colors flex items-center"
                style={{ lineHeight: '1' }}
              >
                loveofminnesota@gmail.com
              </a>
            </div>
          </div>
        </footer>
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
    </div>
  );
}
