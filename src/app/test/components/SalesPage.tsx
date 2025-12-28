'use client';

import React from 'react';
import {
  MapPinIcon,
  HeartIcon,
  GlobeAltIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  PhotoIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

export default function SalesPage() {
  return (
    <div className="space-y-3">
      {/* Section 1: Hero - What It Is */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <div className="space-y-2">
          <h1 className="text-sm font-semibold text-gray-900">Archive Your Minnesota Story</h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            For the Love of Minnesota is a map-based platform where you drop pins to archive special places, memories, and moments across the state. Connect with neighbors, explore locations, and build your personal map of Minnesota experiences.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
          <MapPinIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <p className="text-xs text-gray-600">
            <span className="font-medium text-gray-900">Drop a pin</span> anywhere in Minnesota to mark a place that matters to you
          </p>
        </div>
      </section>

      {/* Section 2: Core Features */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">How It Works</h2>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="p-1.5 bg-gray-100 rounded border border-gray-200 flex-shrink-0">
              <MapPinIcon className="w-3 h-3 text-gray-700" />
            </div>
            <div className="flex-1 space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Create Mentions</p>
              <p className="text-xs text-gray-600">
                Click anywhere on the Minnesota map to drop a pin. Add a description, upload photos, set a date, and choose who can see it—public or private.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="p-1.5 bg-gray-100 rounded border border-gray-200 flex-shrink-0">
              <GlobeAltIcon className="w-3 h-3 text-gray-700" />
            </div>
            <div className="flex-1 space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Explore Minnesota</p>
              <p className="text-xs text-gray-600">
                Browse all 87 counties and hundreds of cities. Discover population data, geographic information, and see what others have shared about each location.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="p-1.5 bg-gray-100 rounded border border-gray-200 flex-shrink-0">
              <UserGroupIcon className="w-3 h-3 text-gray-700" />
            </div>
            <div className="flex-1 space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Connect & Discover</p>
              <p className="text-xs text-gray-600">
                View public mentions from neighbors across the state. See who else has memories at the same locations. Build your personal profile showcasing your Minnesota story.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="p-1.5 bg-gray-100 rounded border border-gray-200 flex-shrink-0">
              <HeartIcon className="w-3 h-3 text-gray-700" />
            </div>
            <div className="flex-1 space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Organize Collections</p>
              <p className="text-xs text-gray-600">
                Group your pins into collections by theme, location, or time period. Keep your memories organized and easy to find.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Key Capabilities */}
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Everything You Need</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <MagnifyingGlassIcon className="w-3 h-3 text-gray-500" />
              <p className="text-xs font-medium text-gray-900">Location Search</p>
            </div>
            <p className="text-xs text-gray-600 pl-4">Find any city, county, or address</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <LockClosedIcon className="w-3 h-3 text-gray-500" />
              <p className="text-xs font-medium text-gray-900">Privacy Control</p>
            </div>
            <p className="text-xs text-gray-600 pl-4">Public or private pins</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <PhotoIcon className="w-3 h-3 text-gray-500" />
              <p className="text-xs font-medium text-gray-900">Media Upload</p>
            </div>
            <p className="text-xs text-gray-600 pl-4">Add photos to your pins</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3 text-gray-500" />
              <p className="text-xs font-medium text-gray-900">Date Tracking</p>
            </div>
            <p className="text-xs text-gray-600 pl-4">Record when events happened</p>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-200">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-900">Interactive Map Features</p>
            <ul className="space-y-0.5 pl-4">
              <li className="text-xs text-gray-600 list-disc">Real-time updates as new mentions are added</li>
              <li className="text-xs text-gray-600 list-disc">Atlas layer showing cities, schools, parks, and more</li>
              <li className="text-xs text-gray-600 list-disc">Points of interest for discovery</li>
              <li className="text-xs text-gray-600 list-disc">3D map controls and navigation</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 4: Value Proposition */}
      <section className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Why For the Love of Minnesota?</h2>
        <div className="space-y-2">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Preserve Your Memories</p>
            <p className="text-xs text-gray-600">
              Create a permanent, visual archive of the places that shaped your life in Minnesota. Your personal map grows with every pin you drop.
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Connect Your Community</p>
            <p className="text-xs text-gray-600">
              See what your neighbors are sharing. Discover shared experiences at the same locations. Build connections through place-based stories.
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Explore the State</p>
            <p className="text-xs text-gray-600">
              Comprehensive directories of all Minnesota cities and counties. Learn about demographics, populations, and geographic data while exploring the map.
            </p>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            <span className="font-medium text-gray-900">Start today:</span> Sign in to drop your first pin and begin building your Minnesota story. No account needed to explore—browse public mentions and discover what others are sharing across the state.
          </p>
        </div>
      </section>
    </div>
  );
}

