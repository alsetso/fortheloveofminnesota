import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getAtlasTypeBySlug } from '@/features/atlas/services/atlasTypesService';
import AtlasMapClient from './AtlasMapClient';
import AtlasComingSoonModal from '@/features/atlas/components/AtlasComingSoonModal';
import PageViewTracker from '@/components/analytics/PageViewTracker';

export const revalidate = 3600;

type Props = {
  params: Promise<{ table: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { table } = await params;
  
  const atlasType = await getAtlasTypeBySlug(table);
  
  if (!atlasType) {
    return {
      title: 'Atlas Map Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/map/atlas/${table}`;
  
  return {
    title: `Minnesota ${atlasType.name} Map | Interactive Atlas`,
    description: `${atlasType.description || `Interactive map of ${atlasType.name.toLowerCase()} in Minnesota`}. Explore ${atlasType.name.toLowerCase()} locations across Minnesota on an interactive map.`,
    keywords: [`Minnesota ${atlasType.name.toLowerCase()} map`, `MN ${atlasType.name.toLowerCase()}`, `${atlasType.name.toLowerCase()} locations`, 'Minnesota geographic data', 'Minnesota interactive map'],
    openGraph: {
      title: `Minnesota ${atlasType.name} Map | Interactive Atlas`,
      description: `${atlasType.description || `Interactive map of ${atlasType.name.toLowerCase()} in Minnesota`}. Explore ${atlasType.name.toLowerCase()} locations across Minnesota.`,
      url,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `Minnesota ${atlasType.name} Map`,
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

export default async function AtlasMapPage({ params }: Props) {
  const { table } = await params;

  const atlasType = await getAtlasTypeBySlug(table);
  
  if (!atlasType) {
    notFound();
  }

  return (
    <>
      <PageViewTracker page_url={`/map/atlas/${table}`} />
      {atlasType.status === 'coming_soon' && (
        <AtlasComingSoonModal typeName={atlasType.name} />
      )}
      <AtlasMapClient atlasType={atlasType} />
    </>
  );
}

