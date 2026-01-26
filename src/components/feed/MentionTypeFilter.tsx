'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';

interface MentionType {
  id: string;
  emoji: string;
  name: string;
  slug: string;
}

export default function MentionTypeFilter() {
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Fetch mention types
  useEffect(() => {
    const fetchMentionTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        
        const typesWithSlugs = (data || []).map(type => ({
          ...type,
          slug: mentionTypeNameToSlug(type.name),
        }));
        
        setMentionTypes(typesWithSlugs);
      } catch (error) {
        console.error('Failed to fetch mention types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMentionTypes();
  }, []);

  // Initialize selected types from URL
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const typesParam = searchParams.get('types');
    const selected = new Set<string>();
    
    if (typesParam) {
      const slugs = typesParam.split(',').map(s => s.trim());
      mentionTypes.forEach(type => {
        if (slugs.includes(type.slug)) {
          selected.add(type.id);
        }
      });
    } else if (typeParam) {
      mentionTypes.forEach(type => {
        if (type.slug === typeParam) {
          selected.add(type.id);
        }
      });
    }
    
    setSelectedTypes(selected);
  }, [mentionTypes, searchParams]);

  const handleTypeToggle = (typeId: string, slug: string) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(typeId)) {
      newSelected.delete(typeId);
    } else {
      newSelected.add(typeId);
    }
    setSelectedTypes(newSelected);

    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    const selectedSlugs = Array.from(newSelected).map(id => {
      const type = mentionTypes.find(t => t.id === id);
      return type?.slug;
    }).filter(Boolean) as string[];

    if (selectedSlugs.length === 0) {
      params.delete('type');
      params.delete('types');
    } else if (selectedSlugs.length === 1) {
      params.set('type', selectedSlugs[0]);
      params.delete('types');
    } else {
      params.set('types', selectedSlugs.join(','));
      params.delete('type');
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Filter by Type</h2>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-8 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Filter by Type</h2>
      <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-hide">
        {mentionTypes.map((type) => {
          const isSelected = selectedTypes.has(type.id);
          return (
            <button
              key={type.id}
              onClick={() => handleTypeToggle(type.id, type.slug)}
              className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2 ${
                isSelected
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="text-base flex-shrink-0">{type.emoji}</span>
              <span className="font-medium truncate">{type.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
