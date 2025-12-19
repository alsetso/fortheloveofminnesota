'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { UserIcon, BookmarkIcon, UserGroupIcon, DocumentTextIcon, CalendarIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { Account, AccountService } from '@/features/auth';
import { useAuth } from '@/features/auth';
import { supabase } from '@/lib/supabase';

interface ProfileCardProps {
  account?: Account | null;
}

interface Page {
  id: string;
  name: string;
  type: string | null;
  industry: string | null;
  account_id: string;
  created_at: string;
}

// Helper function to fetch pages for account
async function fetchUserPages(accountId: string): Promise<Page[]> {
  try {
    const { data, error } = await supabase
      .from('pages')
      .select('id, name, type, industry, account_id, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching pages:', error);
    return [];
  }
}

export default function ProfileCard({ account }: ProfileCardProps) {
  const { user } = useAuth();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user || !account) {
        setLoading(false);
        return;
      }

      try {
        const pagesData = await fetchUserPages(account.id);
        setBusinesses(pagesData || []);
      } catch (error) {
        console.error('Error loading data:', error);
        setBusinesses([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, account]);


  if (!user || loading) {
    return null;
  }

  const totalPages = pages.length;

  // Use account info for main card display
  const displayName = AccountService.getDisplayName(account) || 'User';
  const profileImage = account?.image_url || null;
  
  // Default title/location - can be enhanced with account metadata later
  const title = 'Minnesota Community Member';
  const location = 'Minnesota';
  const company = null;

  return (
    <div className="bg-white rounded-lg border border-[#dfdedc] overflow-hidden lg:sticky lg:top-6">
      {/* Profile Header with Banner */}
      <div className="relative">
        {/* Banner */}
        <div className="h-16 bg-gradient-to-r from-blue-50 to-gray-100"></div>
        
        {/* Profile Photo - Overlapping banner */}
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="w-16 h-16 rounded-full bg-gray-100 border-4 border-white overflow-hidden shadow-sm">
            {profileImage ? (
              <Image
                src={profileImage}
                alt={displayName}
                width={64}
                height={64}
                className="w-full h-full object-cover"
                unoptimized={profileImage.startsWith('data:') || profileImage.includes('supabase.co')}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="pt-10 pb-4 px-4 text-center">
        <Link href="/account/settings" className="block hover:opacity-90 transition-opacity">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <h3 className="text-lg font-bold text-gray-900">
              {displayName}
            </h3>
            {account?.plan === 'plus' && (
              <span className="px-1.5 py-0.5 bg-[#D4AF37] text-white text-[10px] font-semibold rounded uppercase tracking-wide" title="Pro+ Member">
                Pro+
              </span>
            )}
            {account?.plan === 'pro' && (
              <span className="px-1.5 py-0.5 bg-[#D4AF37] text-white text-[10px] font-semibold rounded uppercase tracking-wide" title="Pro Member">
                Pro
              </span>
            )}
          </div>
        </Link>
        <p className="text-sm text-gray-600 mb-1">
          {title}
        </p>
        <p className="text-xs text-gray-500 mb-3">
          {location}
        </p>
        {company && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600 mb-3">
            <div className="w-4 h-4 bg-gray-300 rounded flex items-center justify-center">
              <span className="text-[8px] font-bold text-gray-600">M</span>
            </div>
            <span>{company}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Profile Viewers Section */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Profile viewers</span>
          <Link href="/account/analytics" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            0
          </Link>
        </div>
        <Link 
          href="/account/analytics"
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline mt-1 block"
        >
          View all analytics
        </Link>
      </div>

      {/* My Pages Section */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">My pages</span>
          <span className="text-xs font-semibold text-gray-900">{totalPages}</span>
        </div>
        
        {totalPages > 0 ? (
          <div className="space-y-2 mb-3">
            {/* Render Pages */}
            {pages.map((page) => (
              <Link
                key={page.id}
                href={`/page/${page.id}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors group"
              >
                <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                  <BuildingOfficeIcon className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-900 truncate">
                    {page.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {page.type || page.industry || 'Page'}
                  </div>
                </div>
                <span className="text-xs text-blue-600 group-hover:text-blue-700">
                  0
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 mb-3">
            No pages yet
          </div>
        )}
        
        {/* Grow Pages Section */}
        <div className="border-t border-gray-100 pt-3 mt-3">
          <p className="text-xs text-gray-500 mb-2">Grow your pages faster</p>
          <div className="space-y-2">
            <Link 
              href="/account/change-plan"
              className="flex items-center gap-2 text-xs text-gray-700 hover:text-gray-900"
            >
              <div className="w-5 h-5 bg-yellow-400 rounded flex items-center justify-center">
                <span className="text-[8px] font-bold text-gray-900">★</span>
              </div>
              <span>Try Premium Page</span>
            </Link>
            <Link 
              href="/account/advertise"
              className="flex items-center gap-2 text-xs text-gray-700 hover:text-gray-900"
            >
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold text-blue-600">G</span>
              </div>
              <span>Advertise</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="px-4 py-3 space-y-1">
        <Link
          href="/account/saved"
          className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-50 transition-colors group"
        >
          <BookmarkIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
          <span className="text-sm text-gray-700 group-hover:text-gray-900">Saved items</span>
        </Link>
        <Link
          href="/groups"
          className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-50 transition-colors group"
        >
          <UserGroupIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
          <span className="text-sm text-gray-700 group-hover:text-gray-900">Groups</span>
        </Link>
        <Link
          href="/newsletters"
          className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-50 transition-colors group"
        >
          <DocumentTextIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
          <span className="text-sm text-gray-700 group-hover:text-gray-900">Newsletters</span>
        </Link>
        <Link
          href="/events"
          className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-50 transition-colors group"
        >
          <CalendarIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
          <span className="text-sm text-gray-700 group-hover:text-gray-900">Events</span>
        </Link>
      </div>
    </div>
  );
}

