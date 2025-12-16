/**
 * Cities sitemap - prioritizes favorite cities
 * /sitemap-cities.xml
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const revalidate = 86400; // Revalidate daily

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const supabase = createServerClient();
  
  // Fetch all cities with slugs
  const { data: allCities } = await supabase
    .from('cities')
    .select('slug, favorite, updated_at')
    .not('slug', 'is', null)
    .order('favorite', { ascending: false }) // Favorites first
    .order('updated_at', { ascending: false });

  if (!allCities || allCities.length === 0) {
    return new NextResponse('', { status: 404 });
  }

  const now = new Date().toISOString();
  
  // Separate favorites and non-favorites for priority ordering
  const favoriteCities = allCities.filter(city => city.favorite);
  const otherCities = allCities.filter(city => !city.favorite);
  
  // Combine: favorites first (higher priority), then others
  const sortedCities = [...favoriteCities, ...otherCities];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sortedCities.map((city) => {
  const priority = city.favorite ? '0.9' : '0.7';
  const changefreq = city.favorite ? 'weekly' : 'monthly';
  const lastmod = city.updated_at 
    ? new Date(city.updated_at).toISOString().split('T')[0]
    : now.split('T')[0];
  
  return `  <url>
    <loc>${baseUrl}/explore/city/${city.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}).join('\n')}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}





