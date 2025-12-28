'use client';

import React from 'react';
import {
  MapPinIcon,
  HeartIcon,
  UserGroupIcon,
  SparklesIcon,
  CheckIcon,
  ArrowRightIcon,
  StarIcon,
  PhotoIcon,
  CalendarIcon,
  LockClosedIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

// Component Type 9: Feature Grid with Icons
export function FeatureGrid() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Everything in One Place</h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
          <MapPinIcon className="w-4 h-4 text-gray-700" />
          <p className="text-xs font-medium text-gray-900">Pin Creation</p>
          <p className="text-xs text-gray-600">Mark any location</p>
        </div>
        <div className="p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
          <PhotoIcon className="w-4 h-4 text-gray-700" />
          <p className="text-xs font-medium text-gray-900">Photo Uploads</p>
          <p className="text-xs text-gray-600">Visual memories</p>
        </div>
        <div className="p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
          <HeartIcon className="w-4 h-4 text-gray-700" />
          <p className="text-xs font-medium text-gray-900">Collections</p>
          <p className="text-xs text-gray-600">Organize by theme</p>
        </div>
        <div className="p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
          <LockClosedIcon className="w-4 h-4 text-gray-700" />
          <p className="text-xs font-medium text-gray-900">Privacy</p>
          <p className="text-xs text-gray-600">Your choice</p>
        </div>
        <div className="p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
          <GlobeAltIcon className="w-4 h-4 text-gray-700" />
          <p className="text-xs font-medium text-gray-900">Explore</p>
          <p className="text-xs text-gray-600">87 counties</p>
        </div>
        <div className="p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
          <UserGroupIcon className="w-4 h-4 text-gray-700" />
          <p className="text-xs font-medium text-gray-900">Community</p>
          <p className="text-xs text-gray-600">Shared stories</p>
        </div>
      </div>
    </section>
  );
}

// Component Type 10: Value Props List
export function ValuePropsList() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Why Choose For the Love of Minnesota?</h2>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-900 mt-1.5 flex-shrink-0"></div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Completely Free</p>
            <p className="text-xs text-gray-600">No hidden costs, no premium tiers, no limits</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-900 mt-1.5 flex-shrink-0"></div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Privacy First</p>
            <p className="text-xs text-gray-600">You control what's public and what stays private</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-900 mt-1.5 flex-shrink-0"></div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Easy to Use</p>
            <p className="text-xs text-gray-600">Simple interface, no learning curve</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-900 mt-1.5 flex-shrink-0"></div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Community Driven</p>
            <p className="text-xs text-gray-600">Built by Minnesotans, for Minnesotans</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Component Type 11: Split Content Layout
export function SplitContent() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Two Ways to Use It</h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2 p-2 bg-gray-50 rounded border border-gray-200">
          <h3 className="text-xs font-semibold text-gray-900">For You</h3>
          <ul className="space-y-0.5 text-xs text-gray-600">
            <li>• Personal memory archive</li>
            <li>• Organize favorite places</li>
            <li>• Track where you've been</li>
            <li>• Private collections</li>
          </ul>
        </div>
        <div className="space-y-2 p-2 bg-gray-50 rounded border border-gray-200">
          <h3 className="text-xs font-semibold text-gray-900">For Community</h3>
          <ul className="space-y-0.5 text-xs text-gray-600">
            <li>• Share your favorites</li>
            <li>• Discover new places</li>
            <li>• Connect with neighbors</li>
            <li>• Build collective map</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// Component Type 12: Timeline/Progression
export function TimelineSection() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Your Journey</h2>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">1</span>
          </div>
          <div className="flex-1 space-y-0.5 pt-0.5">
            <p className="text-xs font-medium text-gray-900">Start Exploring</p>
            <p className="text-xs text-gray-600">Browse the map and see what others have shared</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">2</span>
          </div>
          <div className="flex-1 space-y-0.5 pt-0.5">
            <p className="text-xs font-medium text-gray-900">Drop Your First Pin</p>
            <p className="text-xs text-gray-600">Mark a place that matters to you</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">3</span>
          </div>
          <div className="flex-1 space-y-0.5 pt-0.5">
            <p className="text-xs font-medium text-gray-900">Build Your Map</p>
            <p className="text-xs text-gray-600">Add more pins and organize into collections</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 border-2 border-gray-900 flex items-center justify-center">
            <span className="text-xs font-medium text-white">4</span>
          </div>
          <div className="flex-1 space-y-0.5 pt-0.5">
            <p className="text-xs font-medium text-gray-900">Share & Discover</p>
            <p className="text-xs text-gray-600">Connect with others through shared places</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Component Type 13: Comparison Table
export function ComparisonTable() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">What You Get</h2>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="text-xs text-gray-600">Unlimited pins</span>
          <CheckIcon className="w-3 h-3 text-gray-700" />
        </div>
        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="text-xs text-gray-600">Photo uploads</span>
          <CheckIcon className="w-3 h-3 text-gray-700" />
        </div>
        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="text-xs text-gray-600">Collections</span>
          <CheckIcon className="w-3 h-3 text-gray-700" />
        </div>
        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="text-xs text-gray-600">Privacy controls</span>
          <CheckIcon className="w-3 h-3 text-gray-700" />
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-600">Full map access</span>
          <CheckIcon className="w-3 h-3 text-gray-700" />
        </div>
      </div>
    </section>
  );
}

// Component Type 14: Icon Showcase
export function IconShowcase() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">All the Tools You Need</h2>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="p-2 bg-gray-100 rounded border border-gray-200">
            <MapPinIcon className="w-4 h-4 text-gray-700" />
          </div>
          <span className="text-xs text-gray-600">Pins</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="p-2 bg-gray-100 rounded border border-gray-200">
            <PhotoIcon className="w-4 h-4 text-gray-700" />
          </div>
          <span className="text-xs text-gray-600">Photos</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="p-2 bg-gray-100 rounded border border-gray-200">
            <CalendarIcon className="w-4 h-4 text-gray-700" />
          </div>
          <span className="text-xs text-gray-600">Dates</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="p-2 bg-gray-100 rounded border border-gray-200">
            <HeartIcon className="w-4 h-4 text-gray-700" />
          </div>
          <span className="text-xs text-gray-600">Collections</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="p-2 bg-gray-100 rounded border border-gray-200">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-700" />
          </div>
          <span className="text-xs text-gray-600">Search</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="p-2 bg-gray-100 rounded border border-gray-200">
            <GlobeAltIcon className="w-4 h-4 text-gray-700" />
          </div>
          <span className="text-xs text-gray-600">Explore</span>
        </div>
      </div>
    </section>
  );
}

// Component Type 15: Benefits Grid
export function BenefitsGrid() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Benefits</h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5 p-2 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs font-medium text-gray-900">Never Forget</p>
          <p className="text-xs text-gray-600">All your places saved</p>
        </div>
        <div className="space-y-0.5 p-2 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs font-medium text-gray-900">Discover More</p>
          <p className="text-xs text-gray-600">Find new favorites</p>
        </div>
        <div className="space-y-0.5 p-2 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs font-medium text-gray-900">Stay Organized</p>
          <p className="text-xs text-gray-600">Collections keep it tidy</p>
        </div>
        <div className="space-y-0.5 p-2 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs font-medium text-gray-900">Share Safely</p>
          <p className="text-xs text-gray-600">You control privacy</p>
        </div>
      </div>
    </section>
  );
}

// Component Type 16: Simple CTA
export function SimpleCTA() {
  return (
    <section className="bg-white border-2 border-gray-900 rounded-md p-[10px] space-y-2">
      <h2 className="text-sm font-semibold text-gray-900">Ready to Start?</h2>
      <p className="text-xs text-gray-600">
        Create your account and drop your first pin in under a minute.
      </p>
      <button className="w-full px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors">
        Get Started Free
      </button>
    </section>
  );
}

