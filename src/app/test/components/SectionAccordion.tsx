'use client';

import React, { useState } from 'react';
import {
  HomeIcon,
  MapIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  QuestionMarkCircleIcon,
  UserIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import {
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/solid';

interface Section {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  styleVariant: 'minimal' | 'card' | 'bordered' | 'highlight' | 'gradient' | 'icon-first' | 'description-first';
}

const sections: Section[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    icon: HomeIcon,
    description: 'Connect with real estate professionals and discover development opportunities',
    styleVariant: 'minimal',
  },
  {
    id: 'map',
    label: 'Map',
    href: '/map',
    icon: MapIcon,
    description: 'Interactive map of Minnesota showing development opportunities and property acquisitions',
    styleVariant: 'card',
  },
  {
    id: 'explore',
    label: 'Explore',
    href: '/explore',
    icon: GlobeAltIcon,
    description: 'Browse cities, counties, and locations across Minnesota',
    styleVariant: 'bordered',
  },
  {
    id: 'contact',
    label: 'Contact',
    href: '/contact',
    icon: EnvelopeIcon,
    description: 'Get in touch with our team for support and inquiries',
    styleVariant: 'highlight',
  },
  {
    id: 'faqs',
    label: 'FAQs',
    href: '/faqs',
    icon: QuestionMarkCircleIcon,
    description: 'Frequently asked questions about the platform and services',
    styleVariant: 'gradient',
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: UserIcon,
    description: 'View and manage user profiles and mentions',
    styleVariant: 'icon-first',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/account/settings',
    icon: Cog6ToothIcon,
    description: 'Manage your account settings and preferences',
    styleVariant: 'description-first',
  },
];

export default function SectionAccordion() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    const newOpen = new Set(openSections);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenSections(newOpen);
  };

  const renderSection = (section: Section) => {
    const isOpen = openSections.has(section.id);
    const Icon = section.icon;

    switch (section.styleVariant) {
      case 'minimal':
        return (
          <div
            key={section.id}
            className="border-b border-gray-200 last:border-b-0"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-900">{section.label}</span>
              </div>
              {isOpen ? (
                <ChevronUpIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              )}
            </button>
            {isOpen && (
              <div className="px-[10px] pb-[10px]">
                <p className="text-xs text-gray-600">{section.description}</p>
              </div>
            )}
          </div>
        );

      case 'card':
        return (
          <div
            key={section.id}
            className="bg-white border border-gray-200 rounded-md overflow-hidden"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">{section.label}</span>
              </div>
              {isOpen ? (
                <ChevronUpIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              )}
            </button>
            {isOpen && (
              <div className="px-[10px] pb-[10px] border-t border-gray-200 pt-[10px]">
                <p className="text-xs text-gray-600">{section.description}</p>
              </div>
            )}
          </div>
        );

      case 'bordered':
        return (
          <div
            key={section.id}
            className="border-l-2 border-gray-300 pl-[10px]"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between py-[10px] hover:text-gray-900 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">{section.label}</span>
              </div>
              {isOpen ? (
                <ChevronUpIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              )}
            </button>
            {isOpen && (
              <div className="pb-[10px]">
                <p className="text-xs text-gray-600 leading-relaxed">{section.description}</p>
              </div>
            )}
          </div>
        );

      case 'highlight':
        return (
          <div
            key={section.id}
            className="bg-gray-50 border border-gray-200 rounded-md p-[10px]"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white rounded border border-gray-200">
                  <Icon className="w-3 h-3 text-gray-700" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-gray-900 block">{section.label}</span>
                </div>
              </div>
              {isOpen ? (
                <ChevronUpIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              )}
            </button>
            {isOpen && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-600">{section.description}</p>
              </div>
            )}
          </div>
        );

      case 'gradient':
        return (
          <div
            key={section.id}
            className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-md overflow-hidden"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-[10px] hover:from-gray-100 hover:to-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">{section.label}</span>
              </div>
              {isOpen ? (
                <ChevronUpIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              )}
            </button>
            {isOpen && (
              <div className="px-[10px] pb-[10px]">
                <p className="text-xs text-gray-600">{section.description}</p>
              </div>
            )}
          </div>
        );

      case 'icon-first':
        return (
          <div
            key={section.id}
            className="border border-gray-200 rounded-md overflow-hidden"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gray-100 rounded border border-gray-200">
                  <Icon className="w-3 h-3 text-gray-700" />
                </div>
                <span className="text-sm font-medium text-gray-900">{section.label}</span>
              </div>
              {isOpen ? (
                <ChevronUpIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              )}
            </button>
            {isOpen && (
              <div className="px-[10px] pb-[10px] border-t border-gray-200 pt-[10px]">
                <p className="text-xs text-gray-600">{section.description}</p>
              </div>
            )}
          </div>
        );

      case 'description-first':
        return (
          <div
            key={section.id}
            className="bg-white border border-gray-200 rounded-md"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-start justify-between p-[10px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 text-left space-y-1.5">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">{section.label}</span>
                </div>
                {isOpen && (
                  <p className="text-xs text-gray-600 pl-6">{section.description}</p>
                )}
              </div>
              <div className="flex-shrink-0 ml-2">
                {isOpen ? (
                  <ChevronUpIcon className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                )}
              </div>
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      {sections.map(renderSection)}
    </div>
  );
}

