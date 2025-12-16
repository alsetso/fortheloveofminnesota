'use client';

import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Tag } from '@/features/tags/services/tagService';

interface TagSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
  selectedTagId: string;
  onSelect: (tagId: string) => void;
  isLoading: boolean;
}

export function TagSelectorModal({
  isOpen,
  onClose,
  tags,
  selectedTagId,
  onSelect,
  isLoading,
}: TagSelectorModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeTags = tags.filter(tag => tag.entity_type === 'pin' && tag.is_active);

  return (
    <div className="fixed inset-0 z-[400] pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Modal Container - Centered over main content area */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        {/* Container that matches main content width */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={modalRef}
            className="rounded-2xl shadow-2xl overflow-hidden w-full max-h-[50vh] flex flex-col mx-auto"
            style={{
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Header - Compact */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/20">
              <h3 className="text-xs font-semibold text-gray-900">Select Tag</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-3.5 h-3.5 text-gray-700" />
              </button>
            </div>

            {/* Tag List - Compact */}
            <div className="flex-1 overflow-y-auto px-2 py-1.5">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                </div>
              ) : activeTags.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-600">
                  No tags available
                </div>
              ) : (
                <div className="space-y-0.5">
                  {activeTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        onSelect(tag.id);
                        onClose();
                      }}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left
                        ${selectedTagId === tag.id
                          ? 'bg-white/30 text-gray-900 border border-white/40'
                          : 'bg-white/10 hover:bg-white/20 text-gray-700 border border-white/20'
                        }
                      `}
                    >
                      <span className="text-sm flex-shrink-0">{tag.emoji}</span>
                      <span className="text-[11px] font-medium flex-1">{tag.label}</span>
                      {selectedTagId === tag.id && (
                        <span className="text-[9px] text-gray-600">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

