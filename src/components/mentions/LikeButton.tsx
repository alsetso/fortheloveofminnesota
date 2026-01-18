'use client';

import { useState } from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { LikeService } from '@/features/mentions/services/likeService';
import { useAuthStateSafe } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';

interface LikeButtonProps {
  mentionId: string;
  initialLiked: boolean;
  initialCount: number;
  onLikeChange?: (liked: boolean, count: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export default function LikeButton({
  mentionId,
  initialLiked,
  initialCount,
  onLikeChange,
  size = 'md',
  showCount = true,
}: LikeButtonProps) {
  const { account } = useAuthStateSafe();
  const { error: showError } = useToast();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isToggling, setIsToggling] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    
    if (!account?.id || isToggling) return;

    setIsToggling(true);
    const previousLiked = liked;
    const previousCount = count;

    // Optimistic update
    const newLiked = !liked;
    const newCount = newLiked ? count + 1 : Math.max(0, count - 1);
    setLiked(newLiked);
    setCount(newCount);

    try {
      await LikeService.toggleLike(mentionId, account.id, previousLiked);
      onLikeChange?.(newLiked, newCount);
    } catch (error) {
      // Revert on error
      setLiked(previousLiked);
      setCount(previousCount);
      console.error('Failed to toggle like:', error);
      showError('Error', 'Failed to update like. Please try again.');
    } finally {
      setIsToggling(false);
    }
  };

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (!account) return null;

  return (
    <div className="flex items-center gap-1">
      {liked ? (
        <HeartIconSolid 
          onClick={handleClick}
          className={`${sizeClasses[size]} text-red-600 cursor-pointer transition-colors hover:text-red-700 disabled:opacity-50 ${isToggling ? 'opacity-50' : ''}`}
          aria-label="Unlike"
          aria-hidden={false}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(e as any);
            }
          }}
        />
      ) : (
        <HeartIcon 
          onClick={handleClick}
          className={`${sizeClasses[size]} text-gray-500 cursor-pointer transition-colors hover:text-gray-700 disabled:opacity-50 ${isToggling ? 'opacity-50' : ''}`}
          aria-label="Like"
          aria-hidden={false}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(e as any);
            }
          }}
        />
      )}
      {showCount && count > 0 && (
        <span className="text-xs text-gray-600">{count}</span>
      )}
    </div>
  );
}
