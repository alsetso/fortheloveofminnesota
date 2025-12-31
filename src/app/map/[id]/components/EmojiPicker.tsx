'use client';

import { useState, useRef, useEffect } from 'react';

const COMMON_EMOJIS = [
  '📍', '❤️', '👍', '😊', '🎉',
  '🔥', '⭐', '💯', '🎯', '✨',
  '🚀', '💪', '🎨', '🏆', '🌟',
  '💡', '🎪', '🎭', '🎬', '🎵'
];

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  triggerRef?: React.RefObject<HTMLElement>;
}

export default function EmojiPicker({ isOpen, onClose, onSelect, triggerRef }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg p-2 mt-1"
      style={{ minWidth: '200px' }}
    >
      <div className="grid grid-cols-5 gap-1">
        {COMMON_EMOJIS.map((emoji, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
            aria-label={`Select emoji ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

