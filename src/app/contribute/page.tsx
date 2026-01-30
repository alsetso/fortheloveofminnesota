import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import ContributePageClient from './ContributePageClient';

export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/contribute`;
  const title = 'Contribute | For the Love of Minnesota';
  const description = 'Add a pin to the live map and share what you love about Minnesota.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/seo_share_public_image.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Contribute to For the Love of Minnesota',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function ContributePage() {
  const supabase = await createServerClient();

  // Fetch live map ID
  const { data: liveMap, error } = await supabase
    .from('map')
    .select('id, slug')
    .eq('slug', 'live')
    .eq('is_active', true)
    .maybeSingle();

  if (liveMap && !error) {
    const typedLiveMap = liveMap as { id: string; slug: string | null };
    return (
      <ContributePageClient
        mapId={typedLiveMap.id}
        mapSlug={typedLiveMap.slug || 'live'}
      />
    );
  }

  // Fallback to custom_slug for legacy support
  const { data: legacyMap } = await supabase
    .from('map')
    .select('id, slug')
    .eq('custom_slug', 'live')
    .eq('is_primary', true)
    .maybeSingle();

  if (!legacyMap) {
    notFound();
  }

  const typedLegacyMap = legacyMap as { id: string; slug: string | null };
  return (
    <ContributePageClient
      mapId={typedLegacyMap.id}
      mapSlug={typedLegacyMap.slug || 'live'}
    />
  );
}
