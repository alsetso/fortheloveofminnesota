'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  BuildingOfficeIcon, 
  MagnifyingGlassIcon, 
  ChartBarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  MapPinIcon,
  UsersIcon,
  SparklesIcon,
  StarIcon,
  RocketLaunchIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  BanknotesIcon,
  UserGroupIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/features/auth';
import { AccountService, Account } from '@/features/auth';
import BusinessSetupGuide from '@/components/_archive/business/BusinessSetupGuide';
import PlatformServices from '@/components/_archive/business/PlatformServices';
import PageStatsCard from '@/components/_archive/business/BusinessStatsCard';

interface Page {
  id: string;
  name: string;
  type: string | null;
  industry: string | null;
  account_id: string;
  created_at: string;
  logo_url: string | null;
}


export default function BusinessPageClient() {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const accountData = await AccountService.getCurrentAccount();
        setAccount(accountData);
        setPages([]);
      } catch (error) {
        console.error('Error loading data:', error);
        setPages([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-3">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column - Account's Pages (3 columns) */}
        <div className="lg:col-span-3 order-1 lg:order-none">
          <div className="lg:sticky lg:top-20 space-y-3 lg:[max-height:calc(100vh-5rem)]">
            {user && account && pages.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-200">
                  <div className="mb-1.5">
                    <span className="text-xs font-medium text-gray-700">My Pages</span>
                  </div>
                  
                  <div className="space-y-1.5 mb-2">
                    {pages.map((page) => (
                      <Link
                        key={page.id}
                        href={`/page/${page.id}`}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-100">
                          {page.logo_url ? (
                            <Image
                              src={page.logo_url}
                              alt={`${page.name} logo`}
                              width={28}
                              height={28}
                              className="object-cover w-full h-full"
                              unoptimized={page.logo_url.includes('supabase.co')}
                            />
                          ) : (
                            <BuildingOfficeIcon className="w-3.5 h-3.5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {page.name}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="px-3 py-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-1.5">Grow your pages faster</p>
                  <div className="space-y-1.5">
                    <Link 
                      href="/account/change-plan"
                      className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900"
                    >
                      <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-[8px] font-bold text-gray-700">★</span>
                      </div>
                      <span>Try Premium Page</span>
                    </Link>
                    <Link 
                      href="/account/advertise"
                      className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900"
                    >
                      <div className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-[8px] font-bold text-gray-700">G</span>
                      </div>
                      <span>Advertise on MNUDA</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Create Page Card - Show if no pages or not logged in */}
            {(!user || !account || pages.length === 0) && (
              <div className="bg-white border border-gray-200 rounded-md p-3">
                <h3 className="text-xs font-semibold text-gray-900 mb-1.5">Get Started</h3>
                <p className="text-xs text-gray-600 mb-3">
                  {user && account 
                    ? 'Pages: Create or manage pages'
                    : 'Sign in to create and manage your page listings.'}
                </p>
                <Link
                  href={user && account ? "/page/new" : "/?modal=account&tab=settings"}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white font-medium rounded-md hover:bg-gray-800 transition-colors text-xs w-full"
                >
                  <BuildingOfficeIcon className="w-3.5 h-3.5" />
                  {user && account ? 'Pages: Create or manage pages' : 'Sign In'}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Pages Network & Directory (6 columns) */}
        <div className="lg:col-span-6 space-y-3 order-2 lg:order-none">
          {/* Pages Setup Guide */}
          <BusinessSetupGuide />

          {/* Platform Services */}
          <PlatformServices />

          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-1.5">
                <UserGroupIcon className="w-4 h-4 text-gray-600" />
                <h2 className="text-sm font-semibold text-gray-900">Pages Network</h2>
              </div>
            </div>
            <div className="p-[10px] space-y-3">
              {/* Connect with Professionals */}
              <div>
                <div className="flex items-start gap-2">
                  <UserGroupIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold text-gray-900 mb-0.5">Connect with Professionals</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Network with realtors, contractors, lenders, and service providers across Minnesota. Build your referral network.
                    </p>
                  </div>
                </div>
              </div>

              {/* Directory Access */}
              <div>
                <div className="flex items-start gap-2">
                  <BriefcaseIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold text-gray-900 mb-0.5">Directory Access</h3>
                    <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                      Browse and connect with verified pages in your industry. Find partners, suppliers, and service providers.
                    </p>
                    <Link
                      href="/business/directory"
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                    >
                      Browse Directory
                      <ArrowRightIcon className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Service Provider Network */}
              <div>
                <div className="flex items-start gap-2">
                  <UsersIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold text-gray-900 mb-0.5">Service Provider Network</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Find inspectors, appraisers, title companies, attorneys, and other real estate service providers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="pt-2 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">500+</div>
                    <div className="text-xs text-gray-500">Businesses</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">50+</div>
                    <div className="text-xs text-gray-500">Cities</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Quick Actions</h3>
            </div>
            <div className="p-3 space-y-2">
              <Link
                href="/page/new"
                className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors text-xs"
              >
                <BuildingOfficeIcon className="w-4 h-4" />
                Pages: Create or manage pages
              </Link>
              <Link
                href="/business/directory"
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors text-xs"
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
                Browse Directory
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Platform Capabilities (3 columns) */}
        <div className="lg:col-span-3 space-y-3 order-3 lg:order-none">
          {/* Page Stats */}
          <PageStatsCard pageSlug="business" />

          {/* Getting Started */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
            <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
              Ready to Get Started?
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Pages: Create or manage pages
            </p>
            <Link
              href="/page/new"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 text-white font-medium rounded-md hover:bg-gray-800 transition-colors text-xs"
            >
              Pages: Create or manage pages
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

