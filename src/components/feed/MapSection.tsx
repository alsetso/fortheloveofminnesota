'use client';

import Link from 'next/link';
import { MapIcon, PlusIcon } from '@heroicons/react/24/outline';

export default function MapSection() {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <div className="text-center">
        <h3 className="text-sm font-semibold text-gray-900 mb-1.5">Explore the Map</h3>
        <p className="text-xs text-gray-600 mb-3">
          Discover development opportunities, properties, and locations across Minnesota
        </p>
      </div>

      <div className="space-y-2">
        <Link
          href="/map"
          className="flex items-center justify-center gap-2 w-full px-[10px] py-[10px] bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
        >
          <MapIcon className="w-4 h-4" />
          Open Map
        </Link>
        
        <Link
          href="/map?create-new-map=true"
          className="flex items-center justify-center gap-2 w-full px-[10px] py-[10px] border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Create New Map
        </Link>
      </div>

      <div className="pt-2 border-t border-gray-200">
        <p className="text-[10px] text-gray-500 text-center">
          Create pins and areas to mark properties, development sites, and locations of interest
        </p>
      </div>
    </div>
  );
}



