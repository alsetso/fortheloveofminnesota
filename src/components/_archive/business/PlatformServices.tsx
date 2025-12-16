'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Cog6ToothIcon,
  ChartBarIcon,
  MegaphoneIcon,
  RocketLaunchIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

export default function PlatformServices() {
  const [isOpen, setIsOpen] = useState(true); // Component starts open

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Cog6ToothIcon className="w-4 h-4 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">Platform Services</h2>
          </div>
          {isOpen ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-600 mt-0.5">
          Full stack planning, marketing and advertising for Minnesota small businesses
        </p>
      </button>

      {/* Main Content */}
      {isOpen && (
      <div className="p-[10px] space-y-3">
        {/* Introduction */}
        <div>
          <h3 className="text-xs font-semibold text-gray-900 mb-1.5">
            Comprehensive Business Services
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Minnesota small businesses can access professional planning, marketing, and advertising 
            services through the platform. Our integrated approach helps businesses establish their 
            online presence, reach customers, and grow sustainably.
          </p>
        </div>

        {/* Service Categories */}
        <div className="space-y-3">
          {/* Full Stack Planning */}
          <div>
            <div className="flex items-start gap-2">
              <RocketLaunchIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900 mb-0.5">
                  Full Stack Planning
                </h4>
                <p className="text-xs text-gray-600 mb-1.5 leading-relaxed">
                  Strategic business planning services to help you establish and grow your Minnesota business.
                </p>
                <ul className="space-y-1 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Business model development and validation</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Market research and competitive analysis</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Financial planning and revenue projections</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Operational workflow design</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Technology stack recommendations</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Marketing Services */}
          <div>
            <div className="flex items-start gap-2">
              <MegaphoneIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900 mb-0.5">
                  Marketing Services
                </h4>
                <p className="text-xs text-gray-600 mb-1.5 leading-relaxed">
                  Professional marketing services to help Minnesota businesses reach and engage their target audience.
                </p>
                <ul className="space-y-1 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Brand identity and messaging development</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Content strategy and creation</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Social media management and campaigns</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Email marketing and customer communication</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Local market positioning and outreach</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Advertising Services */}
          <div>
            <div className="flex items-start gap-2">
              <ChartBarIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-900 mb-0.5">
                  Advertising Services
                </h4>
                <p className="text-xs text-gray-600 mb-1.5 leading-relaxed">
                  Targeted advertising solutions to increase visibility and drive customer acquisition for Minnesota businesses.
                </p>
                <ul className="space-y-1 text-xs text-gray-600 ml-3">
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Platform advertising and sponsored listings</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Search engine optimization (SEO)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Pay-per-click (PPC) campaign management</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Display advertising and retargeting</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>Performance tracking and analytics</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Service Benefits */}
        <div className="border-t border-gray-200 pt-3">
          <h3 className="text-xs font-semibold text-gray-900 mb-2">
            Service Benefits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-start gap-2">
                <DocumentTextIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Integrated Approach</h4>
                  <p className="text-xs text-gray-600">
                    All services work together seamlessly to support your business growth
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-start gap-2">
                <GlobeAltIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Minnesota Focus</h4>
                  <p className="text-xs text-gray-600">
                    Services tailored specifically for Minnesota small business market
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="border-t border-gray-200 pt-3">
          <div className="p-2 bg-gray-50 border border-gray-200 rounded">
            <p className="text-xs text-gray-700 mb-2">
              <strong>Get Started:</strong> Contact our platform services team to discuss how we can help 
              your Minnesota small business with planning, marketing, and advertising needs.
            </p>
            <Link
              href="/account/advertise"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900"
            >
              Learn More About Platform Services
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

