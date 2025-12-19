/**
 * Static pages sitemap
 * /sitemap-pages.xml
 * Includes all static pages like contact, legal, business, etc.
 */

import { NextResponse } from 'next/server';

export const revalidate = 86400; // Revalidate daily

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const now = new Date().toISOString();

  // Static pages with their priorities and change frequencies
  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/contact', priority: '0.8', changefreq: 'monthly' },
    { path: '/map', priority: '0.9', changefreq: 'weekly' },
    { path: '/explore', priority: '0.9', changefreq: 'weekly' },
    { path: '/explore/cities', priority: '0.8', changefreq: 'weekly' },
    { path: '/explore/counties', priority: '0.8', changefreq: 'weekly' },
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map((page) => `  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}




