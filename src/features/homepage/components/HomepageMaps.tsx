'use client';

import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

export default function HomepageMaps() {
  return (
    <section className="space-y-3 pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">MAPS</h2>
        <Link
          href="/maps"
          className="text-xs text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
        >
          <span>View All</span>
          <ArrowRightIcon className="w-3 h-3" />
        </Link>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
        <div>
          <Link 
            href="/maps?tab=community" 
            className="text-xs font-medium text-gray-900 hover:text-gray-700 transition-colors"
          >
            Community Maps
          </Link>
          <p className="text-xs text-gray-600 mt-0.5">
            Explore maps created by the community, including mentions and shared locations.
          </p>
        </div>
        
        <div>
          <Link 
            href="/maps?tab=professional" 
            className="text-xs font-medium text-gray-900 hover:text-gray-700 transition-colors"
          >
            Professional Maps
          </Link>
          <p className="text-xs text-gray-600 mt-0.5">
            Business and organization maps with advanced features and customization.
          </p>
        </div>
        
        <div>
          <Link 
            href="/maps?tab=atlas" 
            className="text-xs font-medium text-gray-900 hover:text-gray-700 transition-colors"
          >
            Atlas Maps
          </Link>
          <p className="text-xs text-gray-600 mt-0.5">
            Comprehensive geographic data layers including cities, counties, schools, parks, and more.
          </p>
        </div>
        
        <div>
          <Link 
            href="/maps?tab=my-maps" 
            className="text-xs font-medium text-gray-900 hover:text-gray-700 transition-colors"
          >
            My Maps
          </Link>
          <p className="text-xs text-gray-600 mt-0.5">
            Your personal maps and collections. Create and manage your own custom maps.
          </p>
        </div>
      </div>
    </section>
  );
}

