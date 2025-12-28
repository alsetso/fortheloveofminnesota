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
  SparklesIcon,
  BuildingLibraryIcon,
  MapIcon,
} from '@heroicons/react/24/outline';

// Variation 1: Minimal Text-Heavy Approach
export function SalesPageMinimal() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Your Minnesota, Mapped</h1>
        <p className="text-xs text-gray-600 leading-relaxed">
          Every place has a story. For the Love of Minnesota lets you mark the moments, locations, and memories that define your connection to this state. Build your personal archive, one pin at a time.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Simple. Personal. Yours.</h2>
        <div className="space-y-2">
          <p className="text-xs text-gray-600">
            Click the map. Add your memory. Choose who sees it. That's it. No complicated setup, no overwhelming features—just you and the places that matter.
          </p>
          <p className="text-xs text-gray-600">
            Browse what others have shared. Discover new corners of Minnesota. See your state through the eyes of your neighbors.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Start Building Your Map</h2>
        <p className="text-xs text-gray-600">
          Sign in to drop your first pin. Explore without an account. Your Minnesota story is waiting to be told.
        </p>
      </section>
    </div>
  );
}

// Variation 2: Feature-Focused Grid Approach
export function SalesPageGrid() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Map Your Minnesota Story</h1>
        <p className="text-xs text-gray-600">
          A platform built for Minnesotans to preserve, share, and discover the places that shape our lives.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <MapPinIcon className="w-4 h-4 text-gray-700" />
            <p className="text-xs font-medium text-gray-900">Drop Pins</p>
            <p className="text-xs text-gray-600">Mark any location</p>
          </div>
          <div className="space-y-1">
            <PhotoIcon className="w-4 h-4 text-gray-700" />
            <p className="text-xs font-medium text-gray-900">Add Photos</p>
            <p className="text-xs text-gray-600">Visual memories</p>
          </div>
          <div className="space-y-1">
            <LockClosedIcon className="w-4 h-4 text-gray-700" />
            <p className="text-xs font-medium text-gray-900">Control Privacy</p>
            <p className="text-xs text-gray-600">Public or private</p>
          </div>
          <div className="space-y-1">
            <HeartIcon className="w-4 h-4 text-gray-700" />
            <p className="text-xs font-medium text-gray-900">Organize</p>
            <p className="text-xs text-gray-600">Create collections</p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Explore & Connect</h2>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <GlobeAltIcon className="w-3 h-3 text-gray-500" />
            <span>Browse all 87 counties</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <UserGroupIcon className="w-3 h-3 text-gray-500" />
            <span>See what neighbors share</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <MagnifyingGlassIcon className="w-3 h-3 text-gray-500" />
            <span>Search any location</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// Variation 3: Emotional/Story-Driven Approach
export function SalesPageEmotional() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Where Your Story Lives</h1>
        <p className="text-xs text-gray-600 leading-relaxed">
          That lake where you learned to fish. The park where your kids played. The coffee shop that became your routine. These places aren't just locations—they're chapters in your Minnesota story.
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          For the Love of Minnesota gives you a way to mark them, remember them, and share them with others who understand what makes this state special.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">What Makes It Special</h2>
        <div className="space-y-2">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Preserve What Matters</p>
            <p className="text-xs text-gray-600">
              Your memories deserve more than a forgotten photo album. Create a living map that grows with your experiences.
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Find Your People</p>
            <p className="text-xs text-gray-600">
              Discover who else has stories at the same places. Connect through shared experiences and common ground.
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Explore Deeper</p>
            <p className="text-xs text-gray-600">
              Go beyond the map. Learn about every city and county, and see Minnesota through the eyes of those who call it home.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Variation 4: Community-Focused Approach
export function SalesPageCommunity() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Minnesota, Together</h1>
        <p className="text-xs text-gray-600 leading-relaxed">
          We're building a collective map of Minnesota—one where every resident can contribute their perspective, their memories, and their connection to the places we all share.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Join the Community</h2>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <UserGroupIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Share Your Perspective</p>
              <p className="text-xs text-gray-600">
                Add your voice to the map. Your favorite spots, hidden gems, and personal landmarks help others discover what makes Minnesota special.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <HeartIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Discover Shared Experiences</p>
              <p className="text-xs text-gray-600">
                See who else has memories at the same locations. Find common ground with neighbors across the state.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <BuildingLibraryIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Build the Archive</p>
              <p className="text-xs text-gray-600">
                Contribute to a growing archive of Minnesota stories. Every pin adds to our collective understanding of this place we call home.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Variation 5: Utility/Function-First Approach
export function SalesPageUtility() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Minnesota Location Archive</h1>
        <p className="text-xs text-gray-600">
          Map-based platform for archiving locations, memories, and experiences across Minnesota. Create personal maps, explore locations, and connect with others.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Core Functions</h2>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
            <span className="text-xs font-medium text-gray-900">Pin Creation</span>
            <span className="text-xs text-gray-600">Mark locations with descriptions, photos, dates</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
            <span className="text-xs font-medium text-gray-900">Location Database</span>
            <span className="text-xs text-gray-600">87 counties, hundreds of cities with data</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
            <span className="text-xs font-medium text-gray-900">Privacy Controls</span>
            <span className="text-xs text-gray-600">Public or private visibility settings</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-900">Collections</span>
            <span className="text-xs text-gray-600">Organize pins into themed groups</span>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">
          <span className="font-medium text-gray-900">Access:</span> Browse public content without account. Sign in to create and manage your pins.
        </p>
      </section>
    </div>
  );
}

// Variation 6: Benefits-Focused Approach
export function SalesPageBenefits() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Why You'll Love It</h1>
        <div className="space-y-2">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Never Forget a Place</p>
            <p className="text-xs text-gray-600">
              Your favorite spots, meaningful locations, and special moments—all saved on a map you can revisit anytime.
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Discover New Places</p>
            <p className="text-xs text-gray-600">
              See what others love about Minnesota. Find hidden gems and popular spots through shared mentions.
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Share Selectively</p>
            <p className="text-xs text-gray-600">
              Keep some memories private, share others publicly. You control what the community sees.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Everything Included</h2>
        <ul className="space-y-1 text-xs text-gray-600">
          <li className="flex items-start gap-1.5">
            <span className="text-gray-400 mt-0.5">•</span>
            <span>Interactive Minnesota map with all cities and counties</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-gray-400 mt-0.5">•</span>
            <span>Photo uploads for visual memories</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-gray-400 mt-0.5">•</span>
            <span>Date tracking for when events happened</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-gray-400 mt-0.5">•</span>
            <span>Collection organization by theme or location</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-gray-400 mt-0.5">•</span>
            <span>Real-time updates as community adds content</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

