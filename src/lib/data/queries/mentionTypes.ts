/**
 * Mention Type Queries
 * Reference data - cached aggressively (rarely changes)
 */

export interface MentionType {
  id: string;
  name: string;
  emoji: string;
  slug?: string;
}

export const mentionTypeQueries = {
  /**
   * All active mention types
   * Global cache - fetched once, shared across entire app
   */
  all: () => ({
    queryKey: ['mentionTypes', 'all'],
    queryFn: async (): Promise<MentionType[]> => {
      // Fetch directly from Supabase (no API endpoint needed for reference data)
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('mention_types')
        .select('id, name, emoji')
        .eq('is_active', true)
        .order('name');

      if (error) {
        throw new Error(`Failed to fetch mention types: ${error.message}`);
      }

      // Add slug for convenience
      const { mentionTypeNameToSlug } = await import('@/features/mentions/utils/mentionTypeHelpers');
      return (data || []).map(type => ({
        ...type,
        slug: mentionTypeNameToSlug(type.name),
      }));
    },
    staleTime: 60 * 60 * 1000, // 1 hour - reference data rarely changes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in cache for a day
  }),

  /**
   * Single mention type by ID
   */
  byId: (id: string) => ({
    queryKey: ['mentionType', id],
    queryFn: async (): Promise<MentionType> => {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('mention_types')
        .select('id, name, emoji')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) {
        throw new Error(`Failed to fetch mention type: ${error.message}`);
      }

      const { mentionTypeNameToSlug } = await import('@/features/mentions/utils/mentionTypeHelpers');
      return {
        ...data,
        slug: mentionTypeNameToSlug(data.name),
      };
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  }),
};
