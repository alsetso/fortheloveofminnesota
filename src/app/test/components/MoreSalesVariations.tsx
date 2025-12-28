'use client';

import React from 'react';
import {
  MapPinIcon,
  HeartIcon,
  GlobeAltIcon,
  UserGroupIcon,
  SparklesIcon,
  BuildingLibraryIcon,
  MapIcon,
  PhotoIcon,
  LockClosedIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

// Variation 7: Question-Based Approach
export function SalesPageQuestions() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Have You Ever Wondered...</h1>
        <div className="space-y-2">
          <p className="text-xs text-gray-600">
            What if you could map every meaningful place in your Minnesota story? What if you could see who else has memories at your favorite spots? What if exploring the state meant discovering stories, not just locations?
          </p>
          <p className="text-xs text-gray-600">
            For the Love of Minnesota makes all of this possible. It's your personal archive, your discovery tool, and your connection to the Minnesota community—all in one place.
          </p>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">The Answer</h2>
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <ArrowRightIcon className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">Drop pins to mark places that matter</p>
          </div>
          <div className="flex items-start gap-2">
            <ArrowRightIcon className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">Add photos and stories to each location</p>
          </div>
          <div className="flex items-start gap-2">
            <ArrowRightIcon className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">Explore what others have shared</p>
          </div>
          <div className="flex items-start gap-2">
            <ArrowRightIcon className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">Build your personal Minnesota map</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Variation 8: Problem-Solution Approach
export function SalesPageProblemSolution() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">The Problem</h1>
        <p className="text-xs text-gray-600">
          Your favorite places are scattered across photos, memories, and mental notes. There's no easy way to see them all together, share them with others, or discover what your neighbors love about Minnesota.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">The Solution</h2>
        <p className="text-xs text-gray-600">
          For the Love of Minnesota brings all your places together on one interactive map. Mark locations, add context, organize by theme, and see your Minnesota story unfold visually. Plus, discover what others are sharing and connect through shared places.
        </p>
      </section>
    </div>
  );
}

// Variation 9: Before/After Approach
export function SalesPageBeforeAfter() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Before vs. After</h1>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-900">Before</p>
            <ul className="space-y-0.5 text-xs text-gray-600">
              <li>• Photos in random folders</li>
              <li>• Forgotten favorite spots</li>
              <li>• No way to share locations</li>
              <li>• Missing context and dates</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-900">After</p>
            <ul className="space-y-0.5 text-xs text-gray-600">
              <li>• All places on one map</li>
              <li>• Organized by collections</li>
              <li>• Share with community</li>
              <li>• Rich context preserved</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

// Variation 10: Social Proof Approach
export function SalesPageSocialProof() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Join Thousands of Minnesotans</h1>
        <p className="text-xs text-gray-600">
          People across the state are already building their maps, sharing their stories, and discovering new places through For the Love of Minnesota.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center space-y-0.5 p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold text-gray-900">Active Users</p>
            <p className="text-xs text-gray-600">Growing daily</p>
          </div>
          <div className="text-center space-y-0.5 p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold text-gray-900">Pins Created</p>
            <p className="text-xs text-gray-600">Thousands and counting</p>
          </div>
          <div className="text-center space-y-0.5 p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold text-gray-900">Locations Covered</p>
            <p className="text-xs text-gray-600">All 87 counties</p>
          </div>
          <div className="text-center space-y-0.5 p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold text-gray-900">Stories Shared</p>
            <p className="text-xs text-gray-600">Community growing</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Variation 11: Feature-Rich Detailed Approach
export function SalesPageDetailed() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Complete Minnesota Mapping Platform</h1>
        <p className="text-xs text-gray-600">
          For the Love of Minnesota is a comprehensive platform combining personal archiving, community discovery, and geographic exploration into one seamless experience.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Personal Archiving</h2>
        <div className="space-y-1.5 text-xs text-gray-600">
          <p>• Create unlimited pins at any location in Minnesota</p>
          <p>• Add detailed descriptions, photos, and event dates</p>
          <p>• Organize pins into custom collections by theme or location</p>
          <p>• Control visibility with public or private settings</p>
          <p>• Build a visual timeline of your Minnesota experiences</p>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Community Discovery</h2>
        <div className="space-y-1.5 text-xs text-gray-600">
          <p>• Browse public mentions from neighbors across the state</p>
          <p>• See who else has memories at the same locations</p>
          <p>• Discover new places through community recommendations</p>
          <p>• Connect through shared experiences and locations</p>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Geographic Exploration</h2>
        <div className="space-y-1.5 text-xs text-gray-600">
          <p>• Interactive map of entire Minnesota state</p>
          <p>• Complete directory of all 87 counties</p>
          <p>• Comprehensive city database with population data</p>
          <p>• Atlas layer showing cities, schools, parks, and more</p>
          <p>• Points of interest for discovery</p>
        </div>
      </section>
    </div>
  );
}

// Variation 12: Short & Punchy Approach
export function SalesPagePunchy() {
  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <h1 className="text-sm font-semibold text-gray-900">Map Your Minnesota</h1>
        <p className="text-xs text-gray-600 font-medium">
          Drop pins. Add stories. Explore. Connect.
        </p>
        <p className="text-xs text-gray-600">
          That's it. That's the platform.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-4 h-4 text-gray-700" />
          <span className="text-xs font-medium text-gray-900">Mark places</span>
        </div>
        <div className="flex items-center gap-2">
          <PhotoIcon className="w-4 h-4 text-gray-700" />
          <span className="text-xs font-medium text-gray-900">Add photos</span>
        </div>
        <div className="flex items-center gap-2">
          <GlobeAltIcon className="w-4 h-4 text-gray-700" />
          <span className="text-xs font-medium text-gray-900">Explore state</span>
        </div>
        <div className="flex items-center gap-2">
          <UserGroupIcon className="w-4 h-4 text-gray-700" />
          <span className="text-xs font-medium text-gray-900">See what others share</span>
        </div>
      </section>

      <section className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">
          <span className="font-medium text-gray-900">Free.</span> Always.
        </p>
      </section>
    </div>
  );
}

