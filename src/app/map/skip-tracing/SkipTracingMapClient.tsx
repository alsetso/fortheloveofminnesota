'use client';

import Link from 'next/link';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import HomepageMap from '@/features/homepage/components/HomepageMap';

interface SkipTracingMapClientProps {
  cities: Array<{
    id: string;
    name: string;
    slug: string;
    population: string;
    county: string;
  }>;
  counties: Array<{
    id: string;
    name: string;
    slug: string;
    population: string;
    area: string;
  }>;
}

export default function SkipTracingMapClient({ cities, counties }: SkipTracingMapClientProps) {
  const { account } = useAuthStateSafe();
  const { openUpgrade } = useAppModalContextSafe();
  
  const isPro = account?.plan === 'pro' || account?.plan === 'plus';

  return (
    <div className="relative w-full h-full">
      <HomepageMap cities={cities} counties={counties} />
      
      {!isPro && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-md p-6 max-w-sm mx-4 space-y-3 text-center">
            <h2 className="text-sm font-semibold text-gray-900">Upgrade to Pro</h2>
            <p className="text-xs text-gray-600">
              Skip Tracing maps are available for Pro subscribers. Upgrade to access this feature and more.
            </p>
            <button
              onClick={() => openUpgrade()}
              className="w-full text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md py-2 px-4 transition-colors"
            >
              Upgrade to Pro
            </button>
            <Link
              href="/maps"
              className="block w-full text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md py-2 px-4 transition-colors text-center"
            >
              Back to Maps
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

