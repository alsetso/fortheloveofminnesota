/**
 * Counties sitemap - prioritizes favorite counties
 * /sitemap-counties.xml
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const revalidate = 86400; // Revalidate daily

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const supabase = createServerClient();
  
  // Fetch all counties with slugs
  const { data: allCounties } = await supabase
    .from('counties')
    .select('slug, favorite, updated_at')
    .not('slug', 'is', null)
    .order('favorite', { ascending: false }) // Favorites first
    .order('updated_at', { ascending: false });

  if (!allCounties || allCounties.length === 0) {
    return new NextResponse('', { status: 404 });
  }

  const now = new Date().toISOString();
  
  // Separate favorites and non-favorites for priority ordering
  const favoriteCounties = allCounties.filter(county => county.favorite);
  const otherCounties = allCounties.filter(county => !county.favorite);
  
  // Combine: favorites first (higher priority), then others
  const sortedCounties = [...favoriteCounties, ...otherCounties];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sortedCounties.map((county) => {
  const priority = county.favorite ? '0.9' : '0.7';
  const changefreq = county.favorite ? 'weekly' : 'monthly';
  const lastmod = county.updated_at 
    ? new Date(county.updated_at).toISOString().split('T')[0]
    : now.split('T')[0];
  
  return `  <url>
    <loc>${baseUrl}/explore/county/${county.slug}</loc>
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


