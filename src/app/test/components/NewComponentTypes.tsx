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
} from '@heroicons/react/24/outline';

// Component Type 1: Stats/Metrics
export function StatsSection() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Minnesota by the Numbers</h2>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center space-y-0.5">
          <p className="text-xs font-semibold text-gray-900">87</p>
          <p className="text-xs text-gray-600">Counties</p>
        </div>
        <div className="text-center space-y-0.5">
          <p className="text-xs font-semibold text-gray-900">500+</p>
          <p className="text-xs text-gray-600">Cities</p>
        </div>
        <div className="text-center space-y-0.5">
          <p className="text-xs font-semibold text-gray-900">∞</p>
          <p className="text-xs text-gray-600">Stories</p>
        </div>
      </div>
    </section>
  );
}

// Component Type 2: Testimonials/Quotes
export function TestimonialsSection() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">What People Say</h2>
      <div className="space-y-2">
        <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-1">
          <p className="text-xs text-gray-600 italic">
            "Finally, a way to remember all those special places. My kids love seeing where we've been."
          </p>
          <p className="text-xs text-gray-500">— Sarah, Minneapolis</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-1">
          <p className="text-xs text-gray-600 italic">
            "I've discovered so many new spots through what others have shared. It's like a community guidebook."
          </p>
          <p className="text-xs text-gray-500">— Mike, Duluth</p>
        </div>
      </div>
    </section>
  );
}

// Component Type 3: Feature Comparison
export function FeatureComparison() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">What You Get</h2>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <CheckIcon className="w-3 h-3 text-gray-700 flex-shrink-0" />
          <span className="text-xs text-gray-600">Unlimited pins and collections</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckIcon className="w-3 h-3 text-gray-700 flex-shrink-0" />
          <span className="text-xs text-gray-600">Photo uploads for every pin</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckIcon className="w-3 h-3 text-gray-700 flex-shrink-0" />
          <span className="text-xs text-gray-600">Public and private visibility options</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckIcon className="w-3 h-3 text-gray-700 flex-shrink-0" />
          <span className="text-xs text-gray-600">Full access to explore all content</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckIcon className="w-3 h-3 text-gray-700 flex-shrink-0" />
          <span className="text-xs text-gray-600">Real-time community updates</span>
        </div>
      </div>
    </section>
  );
}

// Component Type 4: CTA Section
export function CTASection() {
  return (
    <section className="bg-gray-900 border border-gray-200 rounded-md p-[10px] space-y-2">
      <h2 className="text-sm font-semibold text-white">Ready to Start?</h2>
      <p className="text-xs text-gray-300">
        Join thousands of Minnesotans building their personal maps. Drop your first pin in seconds.
      </p>
      <div className="flex gap-2 pt-1">
        <button className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-900 bg-white rounded hover:bg-gray-100 transition-colors">
          Get Started
        </button>
        <button className="flex-1 px-3 py-1.5 text-xs font-medium text-white border border-gray-700 rounded hover:bg-gray-800 transition-colors">
          Explore First
        </button>
      </div>
    </section>
  );
}

// Component Type 5: Use Cases
export function UseCasesSection() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Perfect For</h2>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <MapPinIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Travel Memories</p>
            <p className="text-xs text-gray-600">Track all the places you've visited across Minnesota</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <HeartIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Family History</p>
            <p className="text-xs text-gray-600">Preserve locations important to your family's story</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <UserGroupIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Local Discovery</p>
            <p className="text-xs text-gray-600">Find new favorite spots through community recommendations</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <SparklesIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Personal Archive</p>
            <p className="text-xs text-gray-600">Build a visual timeline of your Minnesota experiences</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Component Type 6: Process/Steps
export function ProcessSection() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">How It Works</h2>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center">
            <span className="text-xs font-medium">1</span>
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Sign In or Explore</p>
            <p className="text-xs text-gray-600">Create an account or browse public content</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center">
            <span className="text-xs font-medium">2</span>
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Click the Map</p>
            <p className="text-xs text-gray-600">Select any location in Minnesota</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center">
            <span className="text-xs font-medium">3</span>
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Add Your Story</p>
            <p className="text-xs text-gray-600">Write a description, upload photos, set a date</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center">
            <span className="text-xs font-medium">4</span>
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-medium text-gray-900">Share or Keep Private</p>
            <p className="text-xs text-gray-600">Choose who can see your pin</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Component Type 7: Highlight Box
export function HighlightBox() {
  return (
    <section className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-md p-[10px] space-y-2">
      <div className="flex items-center gap-2">
        <StarIcon className="w-4 h-4 text-gray-700" />
        <h2 className="text-sm font-semibold text-gray-900">Free to Use</h2>
      </div>
      <p className="text-xs text-gray-600">
        All core features are free. Create unlimited pins, explore the entire map, and connect with the community—no credit card required.
      </p>
    </section>
  );
}

// Component Type 8: FAQ Preview
export function FAQPreview() {
  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Common Questions</h2>
      <div className="space-y-2">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-gray-900">Do I need an account?</p>
          <p className="text-xs text-gray-600">
            No. You can explore all public content without signing in. Create an account to add your own pins.
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-gray-900">Is it really free?</p>
          <p className="text-xs text-gray-600">
            Yes. All features are free to use. Create unlimited pins, upload photos, and organize collections at no cost.
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-gray-900">Can I keep pins private?</p>
          <p className="text-xs text-gray-600">
            Absolutely. Choose "Only Me" visibility when creating a pin to keep it completely private.
          </p>
        </div>
      </div>
    </section>
  );
}

