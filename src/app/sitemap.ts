import { MetadataRoute } from 'next';
import { createServerClient } from '@/lib/supabaseServer';

export const revalidate = 86400; // Revalidate daily

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const now = new Date();

  // Static pages with their priorities and change frequencies
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/map`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // Fetch cities and counties
  const supabase = createServerClient();
  
  // Fetch all cities with slugs
  const { data: cities } = await supabase
    .from('cities')
    .select('slug, favorite, updated_at')
    .not('slug', 'is', null)
    .order('favorite', { ascending: false })
    .order('updated_at', { ascending: false });

  // Fetch all counties with slugs
  const { data: counties } = await supabase
    .from('counties')
    .select('slug, favorite, updated_at')
    .not('slug', 'is', null)
    .order('favorite', { ascending: false })
    .order('updated_at', { ascending: false });

  // Combine all URLs
  return [...staticPages];
}




