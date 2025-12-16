'use client';

import { useState, useEffect } from 'react';
import MnudaHeroCard from './MnudaHeroCard';
import MapSection from './MapSection';
import CitiesAndCountiesSidebar from '@/components/locations/CitiesAndCountiesSidebar';
import AccountViewsCard from './AccountViewsCard';
import PagesCard from './PagesCard';
import NavigationCard from './NavigationCard';
import UserMapsGrid from './UserMapsGrid';
import Footer from '@/features/ui/components/Footer';
import { AccountService, Account } from '@/features/auth';
import { useAuth } from '@/features/auth';
import { usePageView } from '@/hooks/usePageView';

interface City {
  id: string;
  name: string;
  slug: string;
  population: string;
  county: string;
}

interface County {
  id: string;
  name: string;
  slug: string;
  population: string;
  area: string;
}

interface FeedListClientProps {
  cities: City[];
  counties: County[];
}

export default function FeedListClient({ cities, counties }: FeedListClientProps) {
  // Track page view
  usePageView();
  
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);

  // Load account data
  useEffect(() => {
    const loadAccount = async () => {
      if (!user) {
        setAccount(null);
        return;
      }

      try {
        const accountData = await AccountService.getCurrentAccount();
        setAccount(accountData);
      } catch (error) {
        console.error('Error loading account:', error);
        setAccount(null);
      }
    };

    loadAccount();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-3">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Sidebar - Fixed, no scroll */}
        <div className="lg:col-span-3 hidden lg:block">
          <div className="lg:sticky lg:top-20 space-y-3 lg:[max-height:calc(100vh-5rem)]">
            <AccountViewsCard account={account} />
            <PagesCard account={account} />
            <NavigationCard />
          </div>
        </div>

        {/* Main Content - Map Section */}
        <div className="lg:col-span-6">
          {/* Hero Card */}
          <MnudaHeroCard />
          
          {/* Map Section */}
          <div className="mt-3">
            <MapSection />
          </div>

          {/* User Maps Grid */}
          <UserMapsGrid />
        </div>

        {/* Right Sidebar - Scrolls with page, then sticks when both cards visible */}
        <div className="lg:col-span-3 hidden lg:block">
          <div className="space-y-3">
            <CitiesAndCountiesSidebar cities={cities} counties={counties} />
          </div>
        </div>
      </div>
      
      {/* Large Website Footer */}
      <div className="mt-6">
        <Footer variant="light" />
      </div>
    </div>
  );
}

