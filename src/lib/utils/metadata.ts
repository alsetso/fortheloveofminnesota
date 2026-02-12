import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';

/**
 * Base metadata configuration shared across explore pages
 */
const BASE_METADATA = {
  siteName: 'For the Love of Minnesota',
  locale: 'en_US' as const,
  type: 'website' as const,
  defaultImage: {
    url: '/seo_share_public_image.png',
    width: 1200,
    height: 630,
    type: 'image/png' as const,
  },
};

/**
 * Generates standard robots configuration
 */
function getRobotsConfig(index = true, follow = true) {
  return {
    index,
    follow,
    googleBot: {
      index,
      follow,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  };
}

/**
 * Generates metadata for unpublished/draft pages
 * Prevents search engine indexing while keeping the page accessible
 */
export function generateDraftMetadata(overrides?: Partial<Metadata>): Metadata {
  return {
    ...overrides,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
        'max-video-preview': -1,
        'max-image-preview': 'none' as const,
        'max-snippet': -1,
      },
    },
    ...(overrides?.title ? {} : { title: 'Draft Page' }),
  };
}

/**
 * Generates metadata for explore main page
 */
export function generateExploreMetadata(cityCount: number, countyCount: number): Metadata {
  return {
    title: 'Explore Minnesota | Complete Directory of All Cities & Counties in MN | For the Love of Minnesota',
    description: `Explore Minnesota through comprehensive directories of all ${countyCount || 87} counties and ${cityCount || 'hundreds of'} cities. Discover population data, geographic information, demographics, official county websites, and detailed profiles for every location in Minnesota. Your complete guide to the Land of 10,000 Lakes.`,
    keywords: [
      'Minnesota cities',
      'Minnesota counties',
      'MN cities directory',
      'MN counties directory',
      'Minnesota demographics',
      'Minnesota population',
      'Minnesota geography',
      'Minnesota locations',
      'Minnesota places',
      'Land of 10,000 Lakes',
      'Minnesota information',
      'Minnesota data',
      'Minnesota resources',
    ],
    openGraph: {
      title: 'Explore Minnesota | Complete Directory of All Cities & Counties in MN',
      description: `Explore Minnesota through comprehensive directories of all ${countyCount || 87} counties and ${cityCount || 'hundreds of'} cities.`,
      url: `${BASE_URL}/explore`,
      siteName: BASE_METADATA.siteName,
      images: [BASE_METADATA.defaultImage],
      locale: BASE_METADATA.locale,
      type: BASE_METADATA.type,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Explore Minnesota | Complete Directory of All Cities & Counties in MN',
      description: `Explore Minnesota through comprehensive directories of all ${countyCount || 87} counties and ${cityCount || 'hundreds of'} cities.`,
      images: [BASE_METADATA.defaultImage.url],
    },
    alternates: {
      canonical: `${BASE_URL}/explore`,
    },
    robots: getRobotsConfig(),
  };
}

/**
 * Generates metadata for city detail page
 */
export function generateCityMetadata(
  city: {
    name: string;
    population: number | null;
    county: string | null;
    meta_title: string | null;
    meta_description: string | null;
  },
  slug: string
): Metadata {
  const baseUrl = BASE_URL;
  const url = `${baseUrl}/explore/cities-and-towns/${slug}`;
  const title = city.meta_title || `${city.name}, Minnesota | City Information`;
  const populationText = city.population !== null ? city.population.toLocaleString() : 'N/A';
  const description = city.meta_description || `${city.name}, Minnesota. Population: ${populationText}${city.county ? `, County: ${city.county}` : ''}. Information about ${city.name} including demographics, location, and resources.`;

  return {
    title,
    description,
    keywords: [
      city.name,
      `${city.name} Minnesota`,
      'Minnesota city',
      'MN city',
      'city information',
      'city demographics',
      'city population',
      city.county || '',
      `${city.name} county`,
      'Minnesota geography',
    ],
    openGraph: {
      title,
      description,
      url,
      siteName: BASE_METADATA.siteName,
      locale: BASE_METADATA.locale,
      type: BASE_METADATA.type,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
    robots: getRobotsConfig(),
  };
}

/**
 * Generates metadata for county detail page
 */
export function generateCountyMetadata(
  county: {
    name: string;
    population: number;
    area_sq_mi: number;
    meta_title: string | null;
    meta_description: string | null;
  },
  slug: string
): Metadata {
  const baseUrl = BASE_URL;
  const url = `${baseUrl}/explore/county/${slug}`;
  const title = county.meta_title || `${county.name}, Minnesota | County Information`;
  const description = county.meta_description || `${county.name}, Minnesota. Population: ${county.population.toLocaleString()}, Area: ${county.area_sq_mi.toLocaleString()} sq mi. Information about ${county.name} County including cities, demographics, and resources.`;
  const countyNameShort = county.name.replace(/\s+County$/, '');

  return {
    title,
    description,
    keywords: [
      `${county.name}`,
      `${countyNameShort} County`,
      'Minnesota county',
      'MN county',
      'county information',
      'county demographics',
      'county population',
      'Minnesota geography',
    ],
    openGraph: {
      title,
      description,
      url,
      siteName: BASE_METADATA.siteName,
      locale: BASE_METADATA.locale,
      type: BASE_METADATA.type,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
    robots: getRobotsConfig(),
  };
}

/**
 * Generates not found metadata
 */
export function generateNotFoundMetadata(): Metadata {
  return {
    title: 'Not Found',
    robots: getRobotsConfig(false, false),
  };
}
