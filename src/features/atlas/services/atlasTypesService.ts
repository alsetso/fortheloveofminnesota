import { createServerClient, createServiceClient } from '@/lib/supabaseServer';

export interface AtlasType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_path: string | null;
  is_visible: boolean;
  status: 'active' | 'coming_soon' | 'unlisted';
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all atlas types from database
 * Falls back to anon client if service role key is not available (e.g., during build)
 */
export async function getAtlasTypes(): Promise<AtlasType[]> {
  let supabase;
  
  try {
    supabase = createServiceClient();
  } catch (error) {
    // Fallback to anon client if service role key is not available (e.g., during build)
    supabase = createServerClient();
  }
  
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('atlas_types')
    .select('*')
    .order('display_order', { ascending: true });
  
  if (error) {
    console.error('[AtlasTypesService] Error fetching types:', error);
    return [];
  }
  
  return (data || []) as AtlasType[];
}

/**
 * Fetch a single atlas type by slug
 */
export async function getAtlasTypeBySlug(slug: string): Promise<AtlasType | null> {
  const supabase = createServerClient();
  
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('atlas_types')
    .select('*')
    .eq('slug', slug)
    .single();
  
  if (error) {
    console.error(`[AtlasTypesService] Error fetching type ${slug}:`, error);
    return null;
  }
  
  return data as AtlasType | null;
}

/**
 * Get visible atlas types (for listings/navigation)
 * Returns types where is_visible = true and status = 'active'
 */
export async function getVisibleAtlasTypes(): Promise<AtlasType[]> {
  const types = await getAtlasTypes();
  return types.filter(t => t.is_visible && t.status === 'active');
}

/**
 * Get atlas types that should render pins on map
 * Returns types where status = 'active' (regardless of is_visible)
 */
export async function getMapRenderableAtlasTypes(): Promise<AtlasType[]> {
  const types = await getAtlasTypes();
  return types.filter(t => t.status === 'active');
}

