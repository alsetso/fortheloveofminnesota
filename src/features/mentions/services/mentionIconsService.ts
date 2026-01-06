import { createServerClient, createServiceClient } from '@/lib/supabaseServer';

export interface MentionIcon {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_url: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all mention icons from database
 * Falls back to anon client if service role key is not available (e.g., during build)
 */
export async function getMentionIcons(): Promise<MentionIcon[]> {
  let supabase;
  
  try {
    supabase = createServiceClient();
  } catch (error) {
    // Fallback to anon client if service role key is not available (e.g., during build)
    supabase = createServerClient();
  }
  
  const { data, error } = await supabase
    .from('mention_icons')
    .select('*')
    .order('display_order', { ascending: true });
  
  if (error) {
    console.error('[MentionIconsService] Error fetching icons:', error);
    return [];
  }
  
  return (data || []) as MentionIcon[];
}

/**
 * Fetch active mention icons (for icon selector)
 * Returns icons where is_active = true
 */
export async function getActiveMentionIcons(): Promise<MentionIcon[]> {
  const icons = await getMentionIcons();
  return icons.filter(icon => icon.is_active);
}

/**
 * Fetch a single mention icon by slug
 */
export async function getMentionIconBySlug(slug: string): Promise<MentionIcon | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('mention_icons')
    .select('*')
    .eq('slug', slug)
    .single();
  
  if (error) {
    console.error(`[MentionIconsService] Error fetching icon ${slug}:`, error);
    return null;
  }
  
  return data as MentionIcon | null;
}

