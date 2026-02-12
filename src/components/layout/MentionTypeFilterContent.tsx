'use client';

import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';

interface MentionTypeFilterContentProps {
  onClose?: () => void;
  showHeader?: boolean;
}

type MentionType = { id: string; emoji: string; name: string };

export default function MentionTypeFilterContent({ onClose, showHeader = false }: MentionTypeFilterContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseClient();
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  // Fetch mention types
  useEffect(() => {
    const fetchMentionTypes = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setMentionTypes((data || []) as MentionType[]);
      } catch (error) {
        console.error('Failed to fetch mention types:', error);
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchMentionTypes();
  }, [supabase]);

  // Initialize selected type from URL parameter
  useEffect(() => {
    if (mentionTypes.length > 0) {
      const typeParam = searchParams.get('type');
      const typesParam = searchParams.get('types');
      
      // Handle single type
      if (typeParam) {
        const matchingType = mentionTypes.find(type => {
          const typeSlug = mentionTypeNameToSlug(type.name);
          return typeSlug === typeParam;
        });
        if (matchingType) {
          setSelectedTypeId(matchingType.id);
        }
      } 
      // Handle multiple types - just use the first one (convert to single-select)
      else if (typesParam) {
        const typeSlugs = typesParam.split(',').map(s => s.trim()).filter(Boolean);
        if (typeSlugs.length > 0) {
          const matchingType = mentionTypes.find(type => {
            const typeSlug = mentionTypeNameToSlug(type.name);
            return typeSlug === typeSlugs[0];
          });
          if (matchingType) {
            setSelectedTypeId(matchingType.id);
          }
        }
      }
    }
  }, [mentionTypes, searchParams]);

  // Handle type selection - navigate to maps with type filter
  const handleTypeSelect = (typeId: string) => {
    const selectedType = mentionTypes.find(t => t.id === typeId);
    if (selectedType) {
      const params = new URLSearchParams();
      params.set('type', mentionTypeNameToSlug(selectedType.name));
      router.push(`/maps?${params.toString()}`);
      if (onClose) {
        onClose();
      }
    }
  };

  // Clear filter
  const handleClear = () => {
    setSelectedTypeId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    params.delete('types');
    router.push(params.toString() ? `/maps?${params.toString()}` : '/maps');
  };

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Filter by Mention Type</h2>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loadingTypes ? (
          <div className="text-center text-gray-500 py-8 text-xs">Loading types...</div>
        ) : (
          <>
            {/* Chips wrapped in CSV style */}
            <div className="flex flex-wrap gap-2">
              {mentionTypes.map((type) => {
                const isSelected = selectedTypeId === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelect(type.id)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm">{type.emoji}</span>
                    <span>{type.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Clear button */}
            {selectedTypeId && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <button
                  onClick={handleClear}
                  className="w-full px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Clear filter
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
