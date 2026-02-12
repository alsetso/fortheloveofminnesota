'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  HomeIcon,
  BriefcaseIcon,
  BellIcon,
  EnvelopeIcon,
  KeyIcon,
  ShoppingBagIcon,
  TagIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  PlusIcon,
  TruckIcon,
  BuildingOfficeIcon,
  UserIcon,
  DocumentTextIcon,
  ComputerDesktopIcon,
  VideoCameraIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';

/**
 * Left Sidebar for Marketplace page
 * Navigation, filters, categories, and listing actions
 * Uses URL parameters for navigation and filtering
 */
export default function MarketplaceLeftSidebar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentSection = searchParams.get('section') || 'all';
  const currentCategory = searchParams.get('category');

  const navLinks = [
    { label: 'Browse all', section: 'all', icon: HomeIcon },
    { label: 'Jobs', section: 'jobs', icon: BriefcaseIcon },
    { label: 'Notifications', section: 'notifications', icon: BellIcon },
    { label: 'Inbox', section: 'inbox', icon: EnvelopeIcon },
    { label: 'Marketplace access', section: 'access', icon: KeyIcon },
    { label: 'Buying', section: 'buying', icon: ShoppingBagIcon, hasArrow: true },
    { label: 'Selling', section: 'selling', icon: TagIcon, hasArrow: true },
  ];

  const handleSectionClick = (section: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', section);
    // Keep category if set
    router.push(`/marketplace?${params.toString()}`);
  };

  const categories = [
    { id: 'vehicles', label: 'Vehicles', icon: TruckIcon },
    { id: 'property', label: 'Property Rentals', icon: BuildingOfficeIcon },
    { id: 'apparel', label: 'Apparel', icon: UserIcon },
    { id: 'classifieds', label: 'Classifieds', icon: DocumentTextIcon },
    { id: 'electronics', label: 'Electronics', icon: ComputerDesktopIcon },
    { id: 'entertainment', label: 'Entertainment', icon: VideoCameraIcon },
    { id: 'family', label: 'Family', icon: HeartIcon },
  ];

  const handleCategoryClick = (categoryId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentCategory === categoryId) {
      // Toggle off if already selected
      params.delete('category');
    } else {
      params.set('category', categoryId);
    }
    // Keep section if set
    router.push(`/marketplace?${params.toString()}`);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Marketplace</h2>
        <button className="w-8 h-8 rounded-full hover:bg-surface-accent flex items-center justify-center transition-colors">
          <Cog6ToothIcon className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <input
            type="text"
            placeholder="Search Marketplace"
            className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-sm text-white placeholder:text-white/60 border-none focus:outline-none focus:ring-2 focus:ring-lake-blue"
          />
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
        </div>
      </div>

      {/* Navigation Links */}
      <div className="p-3 space-y-1 border-b border-white/10">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = currentSection === link.section;
          
          return (
            <button
              key={link.label}
              onClick={() => handleSectionClick(link.section)}
              className={`w-full flex items-center justify-between gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                isActive
                  ? 'bg-surface-accent text-white'
                  : 'text-white/70 hover:bg-surface-accent hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </div>
              {link.hasArrow && (
                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="p-3 space-y-2 border-b border-white/10">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium">
          <PlusIcon className="w-4 h-4" />
          Create new listing
        </button>
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-accent border border-white/10 text-white rounded-md hover:bg-surface-accent/80 transition-colors text-sm font-medium">
          Create multiple listings
        </button>
      </div>

      {/* Location Filter */}
      <div className="p-3 border-b border-white/10">
        <h3 className="text-xs font-semibold text-white/60 mb-2">Location</h3>
        <button className="text-sm text-lake-blue hover:text-lake-blue/80 transition-colors">
          Ramsey, Minnesota · Within 5 mi
        </button>
      </div>

      {/* Categories */}
      <div className="p-3">
        <h3 className="text-xs font-semibold text-white/60 mb-2">Categories</h3>
        <div className="space-y-1">
          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = currentCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={`w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                  isSelected
                    ? 'bg-surface-accent text-white'
                    : 'text-white/70 hover:bg-surface-accent hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
