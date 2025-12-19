'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  MapPinIcon, 
  EnvelopeIcon, 
  PhoneIcon, 
  ClockIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon,
  PencilIcon,
  EyeIcon,
  DocumentTextIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import Views from '@/components/ui/Views';
import PageStatsCard from '@/components/_archive/business/BusinessStatsCard';
import Image from 'next/image';

// Shared types - can be imported from either page
export interface Business {
  id: string;
  account_id: string;
  name: string;
  type: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  hours: string | null;
  service_areas: string[] | null;
  logo_url: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
  view_count?: number;
}

import { BusinessWithCities } from '@/types/business';

type ViewMode = 'admin' | 'visitor';

interface BusinessDetailClientProps {
  business: BusinessWithCities;
  isOwner: boolean;
  viewMode: ViewMode;
}

export default function BusinessDetailClient({ business, isOwner, viewMode }: BusinessDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Track page view (always track, same as feed and other public pages)
  usePageView({
    entity_type: 'page',
    entity_id: business.id,
    enabled: true,
  });

  // Toggle view mode
  const toggleViewMode = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (viewMode === 'admin') {
      params.set('view', 'visitor');
    } else {
      params.delete('view'); // Remove param to default to admin
    }
    router.push(`/page/${business.id}?${params.toString()}`);
  };

  // Show admin features only in admin mode
  const showAdminFeatures = viewMode === 'admin' && isOwner;

  return (
    <div className="max-w-7xl mx-auto px-4 py-3">
      {/* Back Button */}
      <button
        onClick={() => router.push('/business/directory')}
        className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 mb-3 transition-colors text-xs font-medium"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>Back to Directory</span>
      </button>

      {/* Two Column Layout - Merged Main + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Main Content Area - Merged Columns 1 & 2 (9 columns) */}
        <div className="lg:col-span-9 space-y-3 order-2 lg:order-none">
          {/* Page Info Card */}
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="p-[10px]">
            {/* Page Header - Horizontal Layout */}
            <div className="flex items-start gap-3 mb-3">
              {/* Page Logo/Icon */}
              <div className="flex-shrink-0">
                {business.logo_url ? (
                  <div className="relative h-14 w-14 rounded-md overflow-hidden border border-gray-200">
                    <Image
                      src={business.logo_url}
                      alt={`${business.name} logo`}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized={business.logo_url.includes('supabase.co')}
                    />
                  </div>
                ) : (
                  <div className="h-14 w-14 bg-gray-900 rounded-md flex items-center justify-center">
                    <BuildingOfficeIcon className="w-7 h-7 text-white" />
                  </div>
                )}
              </div>

              {/* Page Name & Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold text-gray-900 mb-0.5">
                  {business.name}
                </h1>
                {business.category && (
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded border border-gray-200">
                    {business.category.name}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons Row */}
            {isOwner && (
              <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-gray-200">
                {showAdminFeatures && (
                  <>
                    {/* Dashboard links removed - only /business and /business/[id] routes are available */}
                  </>
                )}
                <button
                  onClick={toggleViewMode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 border border-gray-200 font-medium rounded-md hover:bg-gray-50 transition-colors text-xs"
                >
                  {viewMode === 'admin' ? (
                    <>
                      <EyeIcon className="w-3.5 h-3.5" />
                      View as visitor
                    </>
                  ) : (
                    <>
                      <UserIcon className="w-3.5 h-3.5" />
                      View as admin
                    </>
                  )}
                </button>
                {viewMode === 'visitor' && (
                  <div className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-xs text-gray-800 font-medium">Viewing as visitor</p>
                    <p className="text-xs text-gray-600 mt-0.5">Admin features are hidden</p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Stats & Contact Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-gray-200">
              {/* Stats */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Views</span>
                  <Views count={business.view_count || 0} className="text-gray-900 font-medium text-xs" />
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                {business.address && (
                  <div className="flex items-start gap-1.5 text-xs">
                    <MapPinIcon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">{business.address}</span>
                  </div>
                )}
                {business.phone && (
                  <div className="flex items-start gap-1.5 text-xs">
                    <PhoneIcon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <a href={`tel:${business.phone}`} className="text-gray-600 hover:text-gray-900">
                      {business.phone}
                    </a>
                  </div>
                )}
                {business.email && (
                  <div className="flex items-start gap-1.5 text-xs">
                    <EnvelopeIcon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <a href={`mailto:${business.email}`} className="text-gray-600 hover:text-gray-900 break-all">
                      {business.email}
                    </a>
                  </div>
                )}
                {business.hours && (
                  <div className="flex items-start gap-1.5 text-xs">
                    <ClockIcon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600 whitespace-pre-line">{business.hours}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Service Areas */}
            {business.cities && business.cities.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Service Areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {business.cities.map((city) => (
                    <span
                      key={city.id}
                      className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded border border-gray-200"
                    >
                      {city.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Page Posts Section */}
          <div className="space-y-3">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Page posts</h2>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {showAdminFeatures 
                        ? "Manage your page's organic and paid content."
                        : "Content published by this business."
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Empty State */}
            <div className="bg-white border border-gray-200 rounded-md p-6 text-center">
              <DocumentTextIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 text-xs font-medium mb-1">No posts yet</p>
              <p className="text-gray-500 text-xs">
                {showAdminFeatures 
                  ? 'Start sharing content with your audience' 
                  : 'This business hasn\'t published any content yet'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Analytics & Highlights (3 columns) */}
        <div className="lg:col-span-3 space-y-3 order-1 lg:order-none">
          <div className="lg:sticky lg:top-20 space-y-3 lg:[max-height:calc(100vh-5rem)]">
            {/* Page Stats Card */}
            <PageStatsCard pageId={business.id} />



            {/* Registry Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Registry Information</h3>
              </div>
              <div className="p-[10px] space-y-2 text-xs">
                <div>
                  <p className="text-gray-500 mb-0.5">Registry ID</p>
                  <p className="font-mono text-gray-900 text-xs break-all">{business.id}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Registered</p>
                  <p className="text-gray-900">
                    {new Date(business.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Last Updated</p>
                  <p className="text-gray-900">
                    {new Date(business.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
