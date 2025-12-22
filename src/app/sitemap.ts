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
    {
      url: `${baseUrl}/explore`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/explore/cities`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/explore/counties`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
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

  // Build city URLs
  const cityUrls: MetadataRoute.Sitemap = (cities || []).map((city) => ({
    url: `${baseUrl}/explore/city/${city.slug}`,
    lastModified: city.updated_at ? new Date(city.updated_at) : now,
    changeFrequency: (city.favorite ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
    priority: city.favorite ? 0.9 : 0.7,
  }));

  // Build county URLs
  const countyUrls: MetadataRoute.Sitemap = (counties || []).map((county) => ({
    url: `${baseUrl}/explore/county/${county.slug}`,
    lastModified: county.updated_at ? new Date(county.updated_at) : now,
    changeFrequency: (county.favorite ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
    priority: county.favorite ? 0.9 : 0.7,
  }));

  // Combine all URLs
  return [...staticPages, ...cityUrls, ...countyUrls];
}
