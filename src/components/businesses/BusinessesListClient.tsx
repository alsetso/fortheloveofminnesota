'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon, MapPinIcon, PhoneIcon, EnvelopeIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/features/auth';
import { BusinessWithCities } from '@/app/_archive/business/directory/page';

interface BusinessesListClientProps {
  initialBusinesses: BusinessWithCities[];
}

export default function BusinessesListClient({ initialBusinesses }: BusinessesListClientProps) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessWithCities[]>(initialBusinesses);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only showing auth-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchBusinesses = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/businesses');
      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses || []);
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setIsLoading(false);
    }
  };


  // Get unique categories for filter
  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    businesses
      .filter(b => b.category)
      .forEach(b => {
        if (b.category) {
          unique.set(b.category.id, b.category.name);
        }
      });
    return Array.from(unique.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [businesses]);

  // Filter businesses
  const filteredBusinesses = useMemo(() => {
    let filtered = businesses;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.name.toLowerCase().includes(query) ||
        b.category?.name.toLowerCase().includes(query) ||
        b.address?.toLowerCase().includes(query) ||
        b.cities?.some(c => c.name.toLowerCase().includes(query))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(b => b.category?.id === selectedCategory);
    }

    return filtered;
  }, [businesses, searchQuery, selectedCategory]);

  return (
    <div>
      {/* Registry Controls */}
      <div className="mb-3 space-y-2">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search businesses by name, category, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-xs"
            />
          </div>
          <div className="relative sm:w-48">
            <FunnelIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 appearance-none bg-white text-xs"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Toggle and Add Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="font-medium">{filteredBusinesses.length}</span>
            <span>business{filteredBusinesses.length !== 1 ? 'es' : ''} found</span>
          </div>
          <div className="flex items-center gap-2">
            {mounted && user && (
              <Link
                href="/page/new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Register Page
              </Link>
            )}
          </div>
        </div>
      </div>

      {mounted && !user && (
        <div className="mb-3 p-2 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-xs text-gray-700">
            <Link href="/?modal=account&tab=settings" className="font-medium underline hover:text-gray-900">
              Sign in
            </Link>
            {' '}to register your business in the official directory.
          </p>
        </div>
      )}

      {/* Businesses Registry List */}
      {isLoading ? (
        <div className="text-center py-6">
          <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
          <p className="mt-3 text-gray-600 text-xs">Loading registry...</p>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-gray-600 text-xs font-medium">No businesses found</p>
          {(searchQuery || selectedCategory) && (
            <p className="text-gray-500 mt-1.5 text-xs">Try adjusting your search or filters</p>
          )}
          {!searchQuery && !selectedCategory && mounted && user && (
            <p className="text-gray-500 mt-1.5 text-xs">Be the first to register a business!</p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          {/* Registry Table Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
            <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-700 uppercase tracking-wide">
              <div className="col-span-4">Page Name</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-3">Location</div>
              <div className="col-span-2">Service Areas</div>
              <div className="col-span-1">Contact</div>
            </div>
          </div>

          {/* Registry Entries */}
          <div className="divide-y divide-gray-200">
            {filteredBusinesses.map((business) => (
              <div
                key={business.id}
                className="px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  {/* Page Name - Clickable */}
                  <div className="col-span-4">
                    <Link
                      href={`/page/${business.id}`}
                      className="block hover:text-gray-700"
                    >
                      <div className="font-medium text-gray-900 mb-0.5 text-xs">
                        {business.name}
                      </div>
                    </Link>
                  </div>

                  {/* Category */}
                  <div className="col-span-2">
                    {business.category ? (
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded border border-gray-200">
                        {business.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </div>

                  {/* Location */}
                  <div className="col-span-3">
                    {business.address ? (
                      <div className="flex items-start gap-1.5 text-xs text-gray-600">
                        <MapPinIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                        <span className="line-clamp-2">{business.address}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </div>

                  {/* Service Areas */}
                  <div className="col-span-2">
                    {business.cities && business.cities.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {business.cities.slice(0, 2).map((city) => (
                          <span
                            key={city.id}
                            className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded border border-gray-200"
                          >
                            {city.name}
                          </span>
                        ))}
                        {business.cities.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{business.cities.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </div>

                  {/* Contact */}
                  <div className="col-span-1">
                    <div className="flex items-center gap-1.5">
                      {business.phone && (
                        <a
                          href={`tel:${business.phone}`}
                          className="text-gray-600 hover:text-gray-900"
                          title={business.phone}
                        >
                          <PhoneIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {business.email && (
                        <a
                          href={`mailto:${business.email}`}
                          className="text-gray-600 hover:text-gray-900"
                          title={business.email}
                        >
                          <EnvelopeIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {!business.phone && !business.email && (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details (on hover or click) */}
                {(business.hours || (business.cities && business.cities.length > 2)) && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                    {business.hours && (
                      <div className="flex items-start gap-1.5 mb-1.5">
                        <ClockIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                        <span className="whitespace-pre-line">{business.hours}</span>
                      </div>
                    )}
                    {business.cities && business.cities.length > 2 && (
                      <div className="flex flex-wrap gap-1">
                        {business.cities.slice(2).map((city) => (
                          <span
                            key={city.id}
                            className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded border border-gray-200"
                          >
                            {city.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registry Statistics */}
      {businesses.length > 0 && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-900">Registry Statistics</h3>
          </div>
          <div className="p-[10px] grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Total Registered
              </p>
              <p className="text-sm font-semibold text-gray-900">{businesses.length}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Categories
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {new Set(businesses.filter(b => b.category).map(b => b.category?.id)).size}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                With Service Areas
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {businesses.filter(b => b.cities && b.cities.length > 0).length}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                With Contact Info
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {businesses.filter(b => b.phone || b.email).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

