'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';

interface MentionTypeFilterPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

type MentionType = { id: string; emoji: string; name: string };

export default function MentionTypeFilterPopup({ isOpen, onClose }: MentionTypeFilterPopupProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseClient();
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

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

    if (isOpen) {
      fetchMentionTypes();
    }
  }, [supabase, isOpen]);

  // Initialize selected types from URL parameter
  useEffect(() => {
    if (isOpen && mentionTypes.length > 0) {
      const typeParam = searchParams.get('type');
      const selected = new Set<string>();
      
      if (typeParam) {
        // Find matching mention type by slug
        mentionTypes.forEach(type => {
          const typeSlug = mentionTypeNameToSlug(type.name);
          
          if (typeSlug === typeParam) {
            selected.add(type.id);
          }
        });
      }
      
      setSelectedTypes(selected);
    }
  }, [isOpen, mentionTypes, searchParams]);


  // Handle type toggle
  const handleTypeToggle = (typeId: string) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(typeId)) {
      newSelected.delete(typeId);
    } else {
      newSelected.add(typeId);
    }
    setSelectedTypes(newSelected);
  };

  // Apply filters to URL
  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (selectedTypes.size === 0) {
      params.delete('type');
    } else if (selectedTypes.size === 1) {
      // Single selection - use type parameter
      const selectedType = mentionTypes.find(t => selectedTypes.has(t.id));
      if (selectedType) {
        params.set('type', mentionTypeNameToSlug(selectedType.name));
      }
    } else {
      // Multiple selections - use types parameter (comma-separated)
      const slugs = Array.from(selectedTypes)
        .map(id => {
          const type = mentionTypes.find(t => t.id === id);
          return type ? mentionTypeNameToSlug(type.name) : null;
        })
        .filter(Boolean) as string[];
      params.set('types', slugs.join(','));
      params.delete('type');
    }
    
    router.push(`/live?${params.toString()}`);
    onClose();
  };

  // Clear all filters
  const handleClear = () => {
    setSelectedTypes(new Set());
    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    params.delete('types');
    router.push(`/live?${params.toString()}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Filter by Mention Type</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingTypes ? (
            <div className="text-center text-gray-500 py-8">Loading types...</div>
          ) : (
            <div className="space-y-2">
              {mentionTypes.map((type) => {
                const isSelected = selectedTypes.has(type.id);
                return (
                  <button
                    key={type.id}
                    onClick={() => handleTypeToggle(type.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-md border transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl">{type.emoji}</span>
                    <span className={`text-xs font-medium flex-1 text-left ${
                      isSelected ? 'text-blue-900' : 'text-gray-700'
                    }`}>
                      {type.name}
                    </span>
                    {isSelected && (
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[10px]">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-gray-200">
          <button
            onClick={handleClear}
            className="flex-1 px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
