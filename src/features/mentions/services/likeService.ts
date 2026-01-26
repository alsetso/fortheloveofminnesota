import { supabase } from '@/lib/supabase';

/**
 * Service for managing mention likes
 */
export class LikeService {
  /**
   * Like a mention
   * @param mentionId The ID of the mention to like
   * @param accountId The ID of the account liking the mention
   */
  static async likeMention(mentionId: string, accountId: string): Promise<void> {
    const { error } = await supabase
      .from('map_pins_likes')
      .insert({
        map_pin_id: mentionId,
        account_id: accountId,
      });

    if (error) {
      // 23505 = unique constraint violation (already liked)
      if (error.code === '23505') {
        return; // Already liked, no error
      }
      console.error('[LikeService] Error liking mention:', error);
      throw new Error(`Failed to like mention: ${error.message}`);
    }
  }

  /**
   * Unlike a mention
   * @param mentionId The ID of the mention to unlike
   * @param accountId The ID of the account unliking the mention
   */
  static async unlikeMention(mentionId: string, accountId: string): Promise<void> {
    const { error } = await supabase
      .from('map_pins_likes')
      .delete()
      .eq('map_pin_id', mentionId)
      .eq('account_id', accountId);

    if (error) {
      console.error('[LikeService] Error unliking mention:', error);
      throw new Error(`Failed to unlike mention: ${error.message}`);
    }
  }

  /**
   * Toggle like (like if not liked, unlike if liked)
   * @param mentionId The ID of the mention
   * @param accountId The ID of the account
   * @param currentlyLiked Whether the mention is currently liked
   * @returns New liked state (true if now liked, false if now unliked)
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
   * @param mentionId The ID of the mention
   * @returns The number of likes
   */
  static async getLikeCount(mentionId: string): Promise<number> {
    const { count, error } = await supabase
      .from('map_pins_likes')
      .select('*', { count: 'exact', head: true })
      .eq('map_pin_id', mentionId);

    if (error) {
      console.error('[LikeService] Error getting like count:', error);
      throw new Error(`Failed to get like count: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Check if an account has liked a mention
   * @param mentionId The ID of the mention
   * @param accountId The ID of the account
   * @returns True if the account has liked the mention, false otherwise
   */
  static async hasLiked(mentionId: string, accountId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('map_pins_likes')
      .select('id')
      .eq('map_pin_id', mentionId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error)
      console.error('[LikeService] Error checking like status:', error);
      throw new Error(`Failed to check like status: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Get like counts for multiple mentions (batch query)
   * @param mentionIds Array of mention IDs
   * @returns Map of mention ID to like count
   */
  static async getLikeCounts(mentionIds: string[]): Promise<Map<string, number>> {
    if (mentionIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('map_pins_likes')
      .select('map_pin_id')
      .in('map_pin_id', mentionIds);

    if (error) {
      console.error('[LikeService] Error getting like counts:', error);
      throw new Error(`Failed to get like counts: ${error.message}`);
    }

    // Count likes per mention
    const counts = new Map<string, number>();
    mentionIds.forEach(id => counts.set(id, 0));
    
    data?.forEach(like => {
      const current = counts.get(like.map_pin_id) || 0;
      counts.set(like.map_pin_id, current + 1);
    });

    return counts;
  }

  /**
   * Check which mentions an account has liked (batch query)
   * @param mentionIds Array of mention IDs
   * @param accountId The ID of the account
   * @returns Set of mention IDs that the account has liked
   */
  static async getLikedMentionIds(mentionIds: string[], accountId: string): Promise<Set<string>> {
    if (mentionIds.length === 0) {
      return new Set();
    }

    const { data, error } = await supabase
      .from('map_pins_likes')
      .select('map_pin_id')
      .in('map_pin_id', mentionIds)
      .eq('account_id', accountId);

    if (error) {
      console.error('[LikeService] Error getting liked mentions:', error);
      throw new Error(`Failed to get liked mentions: ${error.message}`);
    }

    return new Set(data?.map(like => like.map_pin_id) || []);
  }
}
