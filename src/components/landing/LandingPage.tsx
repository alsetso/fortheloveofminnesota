'use client';

import { useRouter } from 'next/navigation';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { PaperAirplaneIcon, HeartIcon } from '@heroicons/react/24/solid';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useMemo, useState, useEffect } from 'react';
import { useIOSStandalone } from '@/hooks/useIOSStandalone';

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

  // Homepage visit stats
  const [visitStats, setVisitStats] = useState<{ last24Hours: number; previous24Hours: number; total: number } | null>(null);
  const [showTotal, setShowTotal] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="relative w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Homepage Screen Container - 100vh fixed height */}
      <div className="homepageScreenContainer h-screen w-full flex flex-col overflow-hidden" style={{ backgroundColor: '#000000', maxWidth: '100vw' }}>
        {/* Header - Sticky, never moves */}
        <div 
          className="sticky top-0 z-10 px-6 h-[70px] flex items-center justify-between flex-shrink-0" 
          style={{ 
            backgroundColor: '#000000',
            paddingTop: isIOSStandalone ? '20px' : '0px'
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
          <div>
            {user && account ? (
              <button onClick={handleProfileClick} className="flex items-center gap-2">
                <ProfilePhoto account={account} size="sm" />
              </button>
            ) : (
              <button
                onClick={handleGetStarted}
                className="text-white text-sm font-medium hover:text-gray-300 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content Area - calc(100vh - 70px) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-t-3xl scrollbar-hide" style={{ backgroundColor: '#000000', maxWidth: '100vw' }}>
          {/* Hero Content Card - White background with rounded top corners */}
          <div className="min-h-full flex flex-col justify-end pb-0">
            <div className="bg-white rounded-t-3xl flex flex-col items-center justify-center px-6 py-12 space-y-6">
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
            <div className="w-full max-w-sm space-y-2.5 pt-2">
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

          {/* About Section - Horizontal scrolling iOS-style cards */}
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

          {/* Categories Section - Wrapped grid */}
          <div className="relative z-10 bg-white py-8 w-full">
            <div className="max-w-[1200px] mx-auto px-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">All of the things you can post</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* Community & Social */}
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🗣</span>
                  <span className="text-xs text-gray-700 font-medium">Community & Social</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">💬</span>
                  <span className="text-xs text-gray-700 font-medium">Stories & moments</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">📸</span>
                  <span className="text-xs text-gray-700 font-medium">Photos & videos</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">❤️</span>
                  <span className="text-xs text-gray-700 font-medium">Local shoutouts</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🤝</span>
                  <span className="text-xs text-gray-700 font-medium">Meetups & gatherings</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🧭</span>
                  <span className="text-xs text-gray-700 font-medium">Tips & recommendations</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🐕</span>
                  <span className="text-xs text-gray-700 font-medium">Lost & found (pets/items)</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🚨</span>
                  <span className="text-xs text-gray-700 font-medium">Neighborhood alerts</span>
                </div>

                {/* Business & Commerce */}
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">⭐</span>
                  <span className="text-xs text-gray-700 font-medium">Reviews</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🏷</span>
                  <span className="text-xs text-gray-700 font-medium">Things for sale</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🏠</span>
                  <span className="text-xs text-gray-700 font-medium">Listings & rentals</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">💼</span>
                  <span className="text-xs text-gray-700 font-medium">Job postings</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🆕</span>
                  <span className="text-xs text-gray-700 font-medium">New businesses</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">❌</span>
                  <span className="text-xs text-gray-700 font-medium">Closures & changes</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🛍</span>
                  <span className="text-xs text-gray-700 font-medium">Pop-ups & markets</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🧾</span>
                  <span className="text-xs text-gray-700 font-medium">Services offered</span>
                </div>

                {/* Events & Activities */}
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">📅</span>
                  <span className="text-xs text-gray-700 font-medium">Events & festivals</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🎶</span>
                  <span className="text-xs text-gray-700 font-medium">Live music</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🏟</span>
                  <span className="text-xs text-gray-700 font-medium">Sports & games</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🎭</span>
                  <span className="text-xs text-gray-700 font-medium">Arts & performances</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🌽</span>
                  <span className="text-xs text-gray-700 font-medium">Farmers markets</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🧺</span>
                  <span className="text-xs text-gray-700 font-medium">Community sales</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🎟</span>
                  <span className="text-xs text-gray-700 font-medium">Ticketed events</span>
                </div>

                {/* Outdoors & Nature */}
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🌲</span>
                  <span className="text-xs text-gray-700 font-medium">Parks & trails</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🏕</span>
                  <span className="text-xs text-gray-700 font-medium">Campgrounds</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🚶</span>
                  <span className="text-xs text-gray-700 font-medium">Hiking spots</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🚣</span>
                  <span className="text-xs text-gray-700 font-medium">Lakes & rivers</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🎣</span>
                  <span className="text-xs text-gray-700 font-medium">Fishing reports</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">❄️</span>
                  <span className="text-xs text-gray-700 font-medium">Ice & snow conditions</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🌤</span>
                  <span className="text-xs text-gray-700 font-medium">Weather impacts</span>
                </div>

                {/* Infrastructure & Development */}
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🚧</span>
                  <span className="text-xs text-gray-700 font-medium">Construction updates</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🏗</span>
                  <span className="text-xs text-gray-700 font-medium">Development progress</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🛣</span>
                  <span className="text-xs text-gray-700 font-medium">Road conditions</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🚦</span>
                  <span className="text-xs text-gray-700 font-medium">Traffic issues</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🏘</span>
                  <span className="text-xs text-gray-700 font-medium">Zoning changes</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🏠</span>
                  <span className="text-xs text-gray-700 font-medium">Open houses</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">📍</span>
                  <span className="text-xs text-gray-700 font-medium">Before & after photos</span>
                </div>

                {/* Civic & Government */}
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🏛</span>
                  <span className="text-xs text-gray-700 font-medium">Town halls & meetings</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🗳</span>
                  <span className="text-xs text-gray-700 font-medium">Voting locations</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">📢</span>
                  <span className="text-xs text-gray-700 font-medium">Public notices</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">💰</span>
                  <span className="text-xs text-gray-700 font-medium">Spending observations</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">📊</span>
                  <span className="text-xs text-gray-700 font-medium">Transparency updates</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">⚖️</span>
                  <span className="text-xs text-gray-700 font-medium">Policy impacts</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🏢</span>
                  <span className="text-xs text-gray-700 font-medium">Government buildings</span>
                </div>

                {/* Help & Support */}
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🙋</span>
                  <span className="text-xs text-gray-700 font-medium">Volunteer opportunities</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🎁</span>
                  <span className="text-xs text-gray-700 font-medium">Donations & fundraisers</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🤲</span>
                  <span className="text-xs text-gray-700 font-medium">Mutual aid</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🚗</span>
                  <span className="text-xs text-gray-700 font-medium">Ride shares</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🩺</span>
                  <span className="text-xs text-gray-700 font-medium">Community assistance</span>
                </div>
                <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🆘</span>
                  <span className="text-xs text-gray-700 font-medium">Emergency info</span>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
