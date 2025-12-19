import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import BusinessesListClient from '@/components/businesses/BusinessesListClient';
import type { Page } from '@/types/pages';

export const metadata: Metadata = {
  title: 'Minnesota Pages Directory | Official State Pages Registry | MNUDA',
  description: 'Official Minnesota Pages Directory - Search registered pages in Minnesota by name, industry, location, or service area. Public access to page registration information, contact details, and service areas. Maintained in partnership with the State of Minnesota.',
  keywords: [
    'Minnesota business directory',
    'Minnesota business registry',
    'registered businesses Minnesota',
    'Minnesota companies',
    'business search Minnesota',
    'Minnesota Secretary of State',
    'business registration Minnesota',
    'Minnesota business listings',
    'public business directory',
    'Minnesota business information'
  ],
  openGraph: {
    title: 'Minnesota Pages Directory | Official State Pages Registry | MNUDA',
    description: 'Official directory of registered pages operating in Minnesota. Search and discover local companies, services, and professionals across the state.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://mnuda.com'}/business/directory`,
    siteName: 'MNUDA',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Minnesota Pages Registry',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://mnuda.com'}/business/directory`,
  },
};

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
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessWithCities extends Business {
  category: { id: string; name: string } | null;
  cities: Array<{ id: string; name: string }> | null;
}

export default async function BusinessDirectoryPage() {
  const supabase = createServerClient();

  // Fetch all pages
  const { data: pages, error } = await supabase
    .from('pages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pages:', error);
  }

  // Get all unique city IDs from service_areas arrays
  const cityIds = new Set<string>();
  (pages || []).forEach((page: Page) => {
    if (page.service_areas && Array.isArray(page.service_areas)) {
      page.service_areas.forEach((id: string) => cityIds.add(id));
    }
  });

  // Fetch cities in one query
  const citiesMap = new Map<string, { id: string; name: string }>();
  if (cityIds.size > 0) {
    const { data: cities } = await supabase
      .from('cities')
      .select('id, name')
      .in('id', Array.from(cityIds));
    
    if (cities) {
      cities.forEach((city) => citiesMap.set(city.id, city));
    }
  }

  // Transform the data to include cities and category
  const businessesList: BusinessWithCities[] = (pages || []).map((page: Page) => {
    let citiesArray: Array<{ id: string; name: string }> | null = null;
    
    if (page.service_areas && Array.isArray(page.service_areas) && page.service_areas.length > 0) {
      citiesArray = page.service_areas
        .map((id: string) => citiesMap.get(id))
        .filter((city): city is { id: string; name: string } => city !== undefined);
    }

    // Extract category from join (Supabase returns it as an array)
    const category = page.category && Array.isArray(page.category) && page.category.length > 0
      ? page.category[0]
      : null;

    return {
      ...page,
      category: category ? { id: category.id, name: category.name } : null,
      cities: citiesArray && citiesArray.length > 0 ? citiesArray : null,
    };
  });

  return (
    <SimplePageLayout backgroundColor="bg-gray-50" contentPadding="px-0">
      <div className="max-w-7xl mx-auto">
        {/* Official Registry Header */}
        <div>
          <div className="px-[10px] py-3">
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">
                State of Minnesota
              </p>
              <h1 className="text-sm font-semibold text-gray-900">
                Pages Directory
              </h1>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed max-w-3xl">
              Official directory of registered businesses operating within the State of Minnesota. 
              Search by name, industry, location, or service area.
            </p>
          </div>
        </div>

        {/* Three Column Grid Layout */}
        <div className="px-[10px] py-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left Column - Resources & Information (3 columns) */}
            <div className="lg:col-span-3 space-y-3 order-2 lg:order-none">
              {/* Quick Links */}
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="px-[10px] py-[10px] border-b border-gray-200 bg-gray-50">
                  <h2 className="text-xs font-semibold text-gray-900">Quick Links</h2>
                </div>
                <div className="p-[10px] space-y-1.5">
                  <Link href="/business" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Page Registration
                  </Link>
                  <Link href="/page/new" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Pages: Create or manage pages
                  </Link>
                  <Link href="/account/billing" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Page Services
                  </Link>
                  <a href="https://mnsos.gov" target="_blank" rel="noopener noreferrer" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Minnesota Secretary of State
                  </a>
                  <a href="https://www.revenue.state.mn.us" target="_blank" rel="noopener noreferrer" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Department of Revenue
                  </a>
                </div>
              </div>

              {/* Resources */}
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="px-[10px] py-[10px] border-b border-gray-200 bg-gray-50">
                  <h2 className="text-xs font-semibold text-gray-900">Resources</h2>
                </div>
                <div className="p-[10px] space-y-1.5">
                  <div>
                    <p className="text-xs font-medium text-gray-900 mb-0.5">Page Registration</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      All pages operating in Minnesota must register with the Secretary of State. 
                      <Link href="/business" className="text-gray-700 hover:text-gray-900 underline ml-1">
                        Learn more
                      </Link>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-900 mb-0.5">Tax Requirements</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Register for sales tax, withholding tax, and other state tax obligations.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-900 mb-0.5">Licenses & Permits</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Determine required licenses based on your business type and location.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Center Column - Main Directory (6 columns) */}
            <div className="lg:col-span-6 space-y-3 order-1 lg:order-none">
              {/* About the Directory */}
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="px-[10px] py-[10px] border-b border-gray-200 bg-gray-50">
                  <h2 className="text-xs font-semibold text-gray-900">About the Pages Directory</h2>
                </div>
                <div className="p-[10px] space-y-2 text-xs text-gray-600 leading-relaxed">
                  <p>
                    The Minnesota Pages Directory is the official registry of pages operating within the State of Minnesota. 
                    This directory provides public access to business information including contact details, service areas, and industry classifications.
                  </p>
                  <p>
                    All businesses listed in this directory are registered with the State of Minnesota and comply with state business registration requirements. 
                    For information about <Link href="/business" className="text-gray-700 hover:text-gray-900 underline">registering your business</Link>, 
                    visit our business registration page or contact the <a href="https://mnsos.gov" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline">Minnesota Secretary of State</a>.
                  </p>
                  <p>
                    This directory is maintained by MNUDA in partnership with state agencies to provide transparency and accessibility to Minnesota business information.
                  </p>
                </div>
              </div>

              {/* Businesses List */}
              <BusinessesListClient initialBusinesses={businessesList} />
            </div>

            {/* Right Column - Additional Information (3 columns) */}
            <div className="lg:col-span-3 space-y-3 order-3 lg:order-none">
              {/* Legal Information */}
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="px-[10px] py-[10px] border-b border-gray-200 bg-gray-50">
                  <h2 className="text-xs font-semibold text-gray-900">Legal Information</h2>
                </div>
                <div className="p-[10px] space-y-2 text-xs text-gray-600 leading-relaxed">
                  <p>
                    Business information in this directory is provided for public transparency and is subject to Minnesota public records laws. 
                    All businesses must maintain current registration with the Secretary of State.
                  </p>
                  <p>
                    For questions about business registration requirements, visit the 
                    <a href="https://mnsos.gov" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline ml-1">
                      Secretary of State website
                    </a>.
                  </p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="px-[10px] py-[10px] border-b border-gray-200 bg-gray-50">
                  <h2 className="text-xs font-semibold text-gray-900">Contact</h2>
                </div>
                <div className="p-[10px] space-y-1.5 text-xs text-gray-600">
                  <div>
                    <p className="font-medium text-gray-900 mb-0.5">Directory Questions</p>
                    <p>For questions about this directory, contact MNUDA support.</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-0.5">Page Registration</p>
                    <p>
                      <a href="https://mnsos.gov" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline">
                        Minnesota Secretary of State
                      </a>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">(651) 296-2803</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-0.5">Tax Information</p>
                    <p>
                      <a href="https://www.revenue.state.mn.us" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline">
                        Department of Revenue
                      </a>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">(651) 296-6181</p>
                  </div>
                </div>
              </div>

              {/* Related Pages */}
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="px-[10px] py-[10px] border-b border-gray-200 bg-gray-50">
                  <h2 className="text-xs font-semibold text-gray-900">Related Pages</h2>
                </div>
                <div className="p-[10px] space-y-1.5">
                  <Link href="/business" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Page Registration Guide
                  </Link>
                  <Link href="/page/new" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Pages: Create or manage pages
                  </Link>
                  <Link href="/account/billing" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Page Services & Pricing
                  </Link>
                  <Link href="/legal/terms-of-service" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Terms of Service
                  </Link>
                  <Link href="/legal/privacy-policy" className="block text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SimplePageLayout>
  );
}



