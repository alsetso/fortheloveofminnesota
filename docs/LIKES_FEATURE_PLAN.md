# Mentions Likes Feature - Implementation Plan

## Overview
Add ability for accounts to like/unlike mentions (including their own). Heart icon (outline when not liked, filled red when liked) with click to toggle.

## Components Required

### 1. Database Schema
**File:** `supabase/migrations/XXX_create_mentions_likes_table.sql`

```sql
-- Create mentions_likes table
CREATE TABLE public.mentions_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL REFERENCES public.mentions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- One like per account per mention
  CONSTRAINT mentions_likes_unique UNIQUE (mention_id, account_id)
);

-- Indexes for performance
CREATE INDEX idx_mentions_likes_mention_id ON public.mentions_likes(mention_id);
CREATE INDEX idx_mentions_likes_account_id ON public.mentions_likes(account_id);
CREATE INDEX idx_mentions_likes_created_at ON public.mentions_likes(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_mentions_likes_mention_account ON public.mentions_likes(mention_id, account_id);

-- RLS Policies
ALTER TABLE public.mentions_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can view likes (for public mentions)
CREATE POLICY "mentions_likes_select_public"
  ON public.mentions_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mentions
      WHERE mentions.id = mentions_likes.mention_id
      AND visibility = 'public'
    )
  );

-- Authenticated users can view likes on their own mentions
CREATE POLICY "mentions_likes_select_own"
  ON public.mentions_likes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentions
      WHERE mentions.id = mentions_likes.mention_id
      AND mentions.account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    )
  );

-- Authenticated users can like/unlike mentions
CREATE POLICY "mentions_likes_insert"
  ON public.mentions_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.mentions
      WHERE mentions.id = mention_id
      AND (visibility = 'public' OR mentions.account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "mentions_likes_delete"
  ON public.mentions_likes FOR DELETE
  TO authenticated
  USING (
    account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
  );
```

### 2. TypeScript Types
**File:** `src/types/mention.ts`

Add to `Mention` interface:
```typescript
export interface Mention {
  // ... existing fields
  likes_count?: number; // Aggregated count
  is_liked?: boolean; // Whether current user has liked
  // ... rest of fields
}

export interface MentionLike {
  id: string;
  mention_id: string;
  account_id: string;
  created_at: string;
}
```

### 3. Service Layer
**File:** `src/features/mentions/services/likeService.ts`

```typescript
import { supabase } from '@/lib/supabase';

export class LikeService {
  /**
   * Like a mention
   */
  static async likeMention(mentionId: string, accountId: string): Promise<void> {
    const { error } = await supabase
      .from('mentions_likes')
      .insert({
        mention_id: mentionId,
        account_id: accountId,
      });

    if (error) {
      if (error.code === '23505') {
        // Already liked (unique constraint violation)
        return;
      }
      throw new Error(`Failed to like mention: ${error.message}`);
    }
  }

  /**
   * Unlike a mention
   */
  static async unlikeMention(mentionId: string, accountId: string): Promise<void> {
    const { error } = await supabase
      .from('mentions_likes')
      .delete()
      .eq('mention_id', mentionId)
      .eq('account_id', accountId);

    if (error) {
      throw new Error(`Failed to unlike mention: ${error.message}`);
    }
  }

  /**
   * Toggle like (like if not liked, unlike if liked)
   */
  static async toggleLike(mentionId: string, accountId: string, currentlyLiked: boolean): Promise<boolean> {
    if (currentlyLiked) {
      await this.unlikeMention(mentionId, accountId);
      return false;
    } else {
      await this.likeMention(mentionId, accountId);
      return true;
    }
  }

  /**
   * Get like count for a mention
   */
  static async getLikeCount(mentionId: string): Promise<number> {
    const { count, error } = await supabase
      .from('mentions_likes')
      .select('*', { count: 'exact', head: true })
      .eq('mention_id', mentionId);

    if (error) {
      throw new Error(`Failed to get like count: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Check if account has liked a mention
   */
  static async hasLiked(mentionId: string, accountId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('mentions_likes')
      .select('id')
      .eq('mention_id', mentionId)
      .eq('account_id', accountId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to check like status: ${error.message}`);
    }

    return !!data;
  }
}
```

### 4. Update MentionService
**File:** `src/features/mentions/services/mentionService.ts`

Update `getMentions` to include likes data:
- Add `likes_count` via aggregation or join
- Add `is_liked` check for authenticated users
- Use Supabase aggregation or separate query

### 5. UI Components

#### LikeButton Component
**File:** `src/components/mentions/LikeButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { LikeService } from '@/features/mentions/services/likeService';
import { useAuthStateSafe } from '@/features/auth';

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
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isToggling, setIsToggling] = useState(false);

  const handleClick = async () => {
    if (!account?.id || isToggling) return;

    setIsToggling(true);
    const previousLiked = liked;
    const previousCount = count;

    // Optimistic update
    const newLiked = !liked;
    const newCount = newLiked ? count + 1 : count - 1;
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
    <button
      onClick={handleClick}
      disabled={isToggling}
      className="flex items-center gap-1.5 p-1 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
      aria-label={liked ? 'Unlike' : 'Like'}
    >
      {liked ? (
        <HeartIconSolid className={`${sizeClasses[size]} text-red-600`} />
      ) : (
        <HeartIcon className={`${sizeClasses[size]} text-gray-500`} />
      )}
      {showCount && count > 0 && (
        <span className="text-xs text-gray-600">{count}</span>
      )}
    </button>
  );
}
```

### 6. Integration Points

#### MapEntityPopup
**File:** `src/components/layout/MapEntityPopup.tsx`
- Add LikeButton next to view count or in header
- Fetch likes_count and is_liked when popup opens
- Update on like toggle

#### MentionDetailClient
**File:** `src/features/mentions/components/MentionDetailClient.tsx`
- Add LikeButton in meta info section (next to view count)
- Include in initial data fetch

#### Profile Mentions List
**File:** `src/features/profiles/components/ProfileModal.tsx`
- Add LikeButton to each mention in the list
- Show like count inline

### 7. Query Updates

Update `MentionService.getMentions()` to include:
```typescript
// For authenticated users, include likes data
.select(`
  *,
  mentions_likes(count),
  accounts(...),
  collections(...)
`)
```

Or use aggregation:
```typescript
// Add likes_count via aggregation
// Check is_liked separately or via join
```

## Implementation Order

1. **Database migration** - Create table, indexes, RLS policies
2. **Type updates** - Add likes_count and is_liked to Mention type
3. **LikeService** - Create service with all methods
4. **LikeButton component** - Reusable UI component
5. **Update MentionService** - Include likes data in queries
6. **Integration** - Add to MapEntityPopup, MentionDetailClient, ProfileModal
7. **Testing** - Verify like/unlike works, counts update, RLS works

## Considerations

- **Performance**: Use aggregation for counts, not separate queries
- **Real-time**: Optional - add Supabase real-time subscriptions for live updates
- **Caching**: Consider caching like counts to reduce queries
- **Optimistic UI**: Implement optimistic updates for instant feedback
- **Self-likes**: Allow users to like their own mentions (as requested)

## Estimated Effort

- Database migration: 30 min
- Service layer: 1 hour
- UI components: 1 hour
- Integration: 1.5 hours
- Testing & polish: 1 hour
- **Total: ~5 hours**
