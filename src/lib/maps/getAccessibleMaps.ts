/**
 * Get maps accessible to the current user for post creation
 * Returns public maps and maps where user is a member
 */

import { supabase } from '@/lib/supabase';

export interface AccessibleMap {
  id: string;
  name: string;
  slug: string;
  visibility: 'public' | 'private';
  account_id: string;
}

export async function getAccessibleMaps(accountId: string | null): Promise<AccessibleMap[]> {

  if (!accountId) {
    // For anonymous users, only return public maps
    const { data: publicMaps, error } = await supabase
      .schema('maps')
      .from('maps')
      .select('id, name, slug, visibility, account_id')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[getAccessibleMaps] Error fetching public maps:', error);
      return [];
    }

    return (publicMaps || []) as AccessibleMap[];
  }

  // For authenticated users, get:
  // 1. Public maps
  // 2. Private maps where user is a member
  const [publicMapsResult, memberMapsResult] = await Promise.all([
    supabase
      .schema('maps')
      .from('maps')
      .select('id, name, slug, visibility, account_id')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('map_members')
      .select(`
        map_id,
        map:map!map_members_map_id_fkey(
          id,
          name,
          slug,
          visibility,
          account_id
        )
      `)
      .eq('account_id', accountId)
      .eq('map.is_active', true),
  ]);

  if (publicMapsResult.error) {
    console.error('[getAccessibleMaps] Error fetching public maps:', publicMapsResult.error);
  }

  if (memberMapsResult.error) {
    console.error('[getAccessibleMaps] Error fetching member maps:', memberMapsResult.error);
  }

  const publicMaps = (publicMapsResult.data || []) as AccessibleMap[];
  const memberMaps = (memberMapsResult.data || [])
    .map((m: any) => m.map)
    .filter(Boolean) as AccessibleMap[];

  // Combine and deduplicate by id
  const allMaps = [...publicMaps, ...memberMaps];
  const uniqueMaps = Array.from(
    new Map(allMaps.map(map => [map.id, map])).values()
  );

  // Sort by name
  return uniqueMaps.sort((a, b) => a.name.localeCompare(b.name));
}
