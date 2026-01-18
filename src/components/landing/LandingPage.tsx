'use client';

import { useRouter } from 'next/navigation';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useMemo, useState, useEffect } from 'react';

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
    <div className="relative">
      {/* Homepage Screen Container - 100vh/100vw cropped viewport */}
      <div className="homepageScreenContainer h-screen w-screen overflow-hidden relative">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col">
          {/* Hero Section - Fixed Height, Centered */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center px-6 py-12 space-y-6 h-screen relative">
            {/* Homepage Visit Counter - Top Left */}
            {visitStats && (
              <button
                onClick={() => setShowTotal(!showTotal)}
                className="absolute top-4 left-4 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:border-gray-300 transition-all shadow-sm flex items-center gap-1.5"
              >
                {loading ? (
                  'Loading...'
                ) : (
                  <>
                    {isTrending && <span>🔥</span>}
                    {showTotal ? (
                      <span>{visitStats.total.toLocaleString()} total</span>
                    ) : (
                      <span>{visitStats.last24Hours.toLocaleString()} in 24h</span>
                    )}
                  </>
                )}
              </button>
            )}
            {/* Logo */}
            <div className="relative w-20 h-20 mb-2 animate-fade-in">
              <Image
                src="/logo.png"
                alt="For the Love of Minnesota"
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            {/* Main Heading */}
            <div className="text-center space-y-3 max-w-md">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                For the Love of
                <span className="block text-red-600">Minnesota</span>
              </h1>
              <p className="text-base sm:text-lg font-medium text-gray-700 leading-relaxed px-2">
                Share what you love. Discover what others do.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed px-2">
                This is a map built on appreciation.
              </p>
            </div>

            {/* Core Message */}
            <div className="w-full max-w-sm space-y-2 text-center">
              <p className="text-sm text-gray-700 leading-relaxed">
                The places you go back to.<br />
                The views you don't forget.<br />
                The spots you tell friends about.
              </p>
              <p className="text-sm font-medium text-gray-900 leading-relaxed">
                Drop them on the map — so other Minnesotans can find them too.
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
            </div>

            {/* Scroll Indicator */}
            <div className="flex flex-col items-center justify-center mt-8 animate-bounce">
              <ChevronDownIcon className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* About Section - Fixed Height, No Scroll */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 py-5">
        <div className="max-w-[600px] mx-auto px-6 space-y-4 text-left">
        {/* The Core Idea */}
        <section className="space-y-1">
          <h2 className="text-sm font-bold text-gray-900">The Core Idea</h2>
          <p className="text-xs text-gray-700 leading-snug font-medium">
            If you love it, someone else probably will too.
          </p>
          <p className="text-xs text-gray-600 leading-snug">
            For the Love of Minnesota lets you mark things worth knowing about — quietly great places, moments, and experiences — and share them with people who actually care.
          </p>
          <p className="text-xs text-gray-600 leading-snug">
            No algorithms chasing outrage. No paid placements. Just real love, placed on the map.
          </p>
        </section>

        {/* How It Works */}
        <section className="space-y-1">
          <h2 className="text-sm font-bold text-gray-900">How It Works</h2>
          <div className="space-y-1 text-xs text-gray-700">
            <div className="flex items-start gap-1.5">
              <span className="text-indigo-600 font-semibold">📍</span>
              <span>Drop a pin where something matters to you</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-red-600 font-semibold">❤️</span>
              <span>Add why you love it</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-indigo-600 font-semibold">👀</span>
              <span>Let others discover it naturally</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-indigo-600 font-semibold">🗺</span>
              <span>Watch the map fill with meaning</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 leading-snug mt-1.5">
            Every pin makes Minnesota more visible — one genuine moment at a time.
          </p>
        </section>

        {/* Why This Feels Different */}
        <section className="space-y-1">
          <h2 className="text-sm font-bold text-gray-900">Why This Feels Different</h2>
          <p className="text-xs text-gray-600 leading-snug">
            Most platforms push what's loud. This one reveals what's loved.
          </p>
          <p className="text-xs text-gray-600 leading-snug">
            Over time, patterns form. Favorites rise. Hidden gems stop being hidden — but never feel corporate.
          </p>
          <p className="text-xs text-gray-700 leading-snug font-medium">
            What people love becomes the signal.
          </p>
        </section>

        {/* Built for Minnesotans */}
        <section className="space-y-1">
          <h2 className="text-sm font-bold text-gray-900">Built for Minnesotans</h2>
          <div className="space-y-0.5 text-xs text-gray-600">
            <div className="flex items-start gap-1.5">
              <span className="text-indigo-600">•</span>
              <span>Local-first by design</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-indigo-600">•</span>
              <span>Simple enough to use instantly</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-indigo-600">•</span>
              <span>Deep enough to grow with the community</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-indigo-600">•</span>
              <span>Shaped by the people who show up early</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 leading-snug mt-1">
            This is about pride, care, and presence — not performance.
          </p>
        </section>

        {/* What This Becomes */}
        <section className="space-y-1">
          <h2 className="text-sm font-bold text-gray-900">What This Becomes</h2>
          <p className="text-xs text-gray-600 leading-snug">
            A living guide powered by real affection. A shared sense of place across the entire state. A way to see Minnesota through each other's eyes.
          </p>
          <p className="text-xs text-gray-700 leading-snug font-medium">
            When people mark what they love, the map starts to mean something.
          </p>
        </section>

        {/* Coming to iOS */}
        <section className="space-y-1">
          <h2 className="text-sm font-bold text-gray-900">Coming to iOS</h2>
          <p className="text-xs text-gray-600 leading-snug">
            We're finalizing approval and preparing the next release. Early users aren't just downloading an app — they're setting the tone.
          </p>
          <p className="text-xs text-gray-600 leading-snug">
            We read every comment. We respond to DMs. We build based on what you say.
          </p>
        </section>

        {/* Start With Love */}
        <section className="space-y-1 pt-1.5 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Start With Love</h2>
          <p className="text-xs text-gray-600 leading-snug">
            If there's a place you'd recommend without hesitation — If there's a moment you wish others could experience — If you love Minnesota and want to show it —
          </p>
          <p className="text-xs text-gray-700 leading-snug font-medium">
            This is for you.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-1 pt-1.5 border-t border-gray-100">
          <p className="text-xs text-gray-600 leading-snug">
            <a 
              href="mailto:loveofminnesota@gmail.com" 
              className="text-red-600 hover:text-red-700 underline font-medium"
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
        </section>
        </div>
      </div>
    </div>
  );
}
