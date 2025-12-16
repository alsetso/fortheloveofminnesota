'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, ChevronUpIcon, TagIcon, CheckIcon } from '@heroicons/react/24/outline';
import { TagService, Tag } from '@/features/tags/services/tagService';

interface TagsFilterDropdownProps {
  selectedTagIds: string[] | null;
  onTagIdsChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagsFilterDropdown({
  selectedTagIds,
  onTagIdsChange,
  disabled = false,
}: TagsFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load tags
  useEffect(() => {
    const loadTags = async () => {
      setIsLoading(true);
      try {
        const allTags = await TagService.getPublicTagsByEntityType('pin');
        setTags(allTags);
      } catch (err) {
        console.error('Error loading tags:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTags();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleTagToggle = (tagId: string) => {
    const current = selectedTagIds || [];
    const newSelected = current.includes(tagId)
      ? current.filter(id => id !== tagId)
      : [...current, tagId];
    onTagIdsChange(newSelected);
  };

  const handleSelectAll = () => {
    const current = selectedTagIds || [];
    if (current.length === tags.length) {
      onTagIdsChange([]);
    } else {
      onTagIdsChange(tags.map(t => t.id));
    }
  };

  const selectedCount = (selectedTagIds || []).length;
  const totalCount = tags.length;

  return (
    <div 
      className="fixed top-4 right-4 z-[100] pointer-events-auto"
      style={{ overflow: 'visible' }}
      ref={dropdownRef}
    >
      <div 
        className="rounded-2xl border shadow-xl max-w-[95vw] transition-all duration-300"
        style={{
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          borderColor: 'rgba(255, 255, 255, 0.4)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
          overflow: 'visible',
        }}
      >
        {/* Compact Header */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="px-2.5 py-1 rounded-lg font-medium text-xs bg-white/40 text-gray-900 shadow-sm flex items-center gap-1.5">
            <TagIcon className="w-3 h-3" />
            <span>
              {isLoading ? 'Loading...' : selectedCount === totalCount ? 'All Tags' : `${selectedCount}/${totalCount}`}
            </span>
          </div>
          
          {/* Toggle Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled || isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-xs bg-white/20 text-gray-700 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isOpen ? (
              <ChevronUpIcon className="w-3 h-3" />
            ) : (
              <ChevronDownIcon className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* Expanded Dropdown - iOS Style */}
        {isOpen && !isLoading && (
          <div 
            className="px-3 pb-3 border-t border-white/20"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
            }}
          >
            {/* Header with Select All */}
            <div className="pt-2.5 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-800">Filter by Tags</span>
              <button
                onClick={handleSelectAll}
                className="text-xs font-medium text-gray-700 hover:text-gray-900 px-2 py-1 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }}
              >
                {selectedCount === totalCount ? 'Clear All' : 'Select All'}
              </button>
            </div>

            {/* Tags List */}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {tags.length === 0 ? (
                <div className="px-2.5 py-4 text-center text-xs text-gray-500">
                  No tags available
                </div>
              ) : (
                tags.map((tag) => {
                  const isSelected = (selectedTagIds || []).includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleTagToggle(tag.id)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all active:scale-[0.98]"
                      style={{
                        backgroundColor: isSelected 
                          ? 'rgba(34, 197, 94, 0.15)' 
                          : 'rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {/* iOS-style Checkbox */}
                      <div 
                        className="flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                        style={{
                          borderColor: isSelected ? '#22c55e' : 'rgba(0, 0, 0, 0.3)',
                          backgroundColor: isSelected ? '#22c55e' : 'transparent',
                        }}
                      >
                        {isSelected && (
                          <CheckIcon className="w-3 h-3 text-white" />
                        )}
                      </div>
                      
                      {/* Emoji */}
                      <span className="text-base">{tag.emoji}</span>
                      
                      {/* Label */}
                      <span 
                        className="flex-1 text-left text-xs font-medium"
                        style={{
                          color: isSelected ? 'rgba(34, 197, 94, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                        }}
                      >
                        {tag.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

