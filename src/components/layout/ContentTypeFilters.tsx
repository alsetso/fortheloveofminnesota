'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useHeaderTheme } from '@/contexts/HeaderThemeContext';

/**
 * Content Type Filters Component
 * 
 * Displays filter buttons for content types (Posts, Mentions, Users, News)
 * in search mode. Manages URL state for content type filtering.
 */
export default function ContentTypeFilters() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isDefaultLightBg } = useHeaderTheme();

  // Memoize contentTypes to prevent recreation on every render
  const contentTypes = useMemo(() => [
    { id: 'posts', label: 'Posts' },
    { id: 'mentions', label: 'Mentions' },
    { id: 'users', label: 'Users' },
    { id: 'news', label: 'News' },
  ], []);

  // Initialize selected type from URL
  useEffect(() => {
    const contentTypeParam = searchParams.get('content_type');
    
    if (contentTypeParam && contentTypes.some(ct => ct.id === contentTypeParam)) {
      setSelectedType(contentTypeParam);
    } else {
      setSelectedType(null);
    }
  }, [searchParams, contentTypes]);

  const handleTypeSelect = (typeId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Single select: if clicking the same type, deselect it
    if (selectedType === typeId) {
      params.delete('content_type');
      setSelectedType(null);
    } else {
      params.set('content_type', typeId);
      setSelectedType(typeId);
    }
    
    // Always delete content_types param (legacy support)
    params.delete('content_types');

    router.push(`${pathname}?${params.toString()}`);
  };

  const selectedClass = isDefaultLightBg
    ? 'text-[#3C3C43] bg-black/10 font-semibold'
    : 'text-white bg-white/20 font-semibold';
  const unselectedClass = isDefaultLightBg
    ? 'text-[#3C3C43]/60 hover:text-[#3C3C43]/80 hover:bg-black/5'
    : 'text-white opacity-50 hover:opacity-75 hover:bg-white/10';

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {contentTypes.map((type) => {
        const isSelected = selectedType === type.id;
        return (
          <button
            key={type.id}
            onClick={() => handleTypeSelect(type.id)}
            className={`text-sm font-medium transition-all whitespace-nowrap px-2 py-1 rounded-md ${
              isSelected ? selectedClass : unselectedClass
            }`}
          >
            {type.label}
          </button>
        );
      })}
    </div>
  );
}
