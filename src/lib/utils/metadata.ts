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
    url: '/logo.png',
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
      'Twin Cities',
      'Minneapolis',
      'St. Paul',
      'Hennepin County',
      'Ramsey County',
      'Minnesota locations',
      'MN city data',
      'MN county data',
    ],
    openGraph: {
      title: 'Explore Minnesota | Complete Directory of All Cities & Counties in MN | For the Love of Minnesota',
      description: `Explore Minnesota through comprehensive directories of all ${countyCount || 87} counties and ${cityCount || 'hundreds of'} cities. Discover population data, geographic information, and detailed profiles for every location in Minnesota.`,
      url: `${BASE_URL}/explore`,
      siteName: BASE_METADATA.siteName,
      images: [
        {
          ...BASE_METADATA.defaultImage,
          alt: 'Explore Minnesota - Complete Cities and Counties Directory',
        },
      ],
      locale: BASE_METADATA.locale,
      type: BASE_METADATA.type,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Explore Minnesota | Complete Directory of All Cities & Counties in MN',
      description: `Explore Minnesota through comprehensive directories of all ${countyCount || 87} counties and ${cityCount || 'hundreds of'} cities.`,
      images: ['/logo.png'],
    },
    alternates: {
      canonical: `${BASE_URL}/explore`,
    },
    robots: getRobotsConfig(),
  };
}

/**
 * Generates metadata for cities list page
 */
export function generateCitiesMetadata(cityCount: number): Metadata {
  return {
    title: `Minnesota Cities Directory | Complete List of All Cities in MN`,
    description: `Complete directory of all Minnesota cities. Browse cities by population, county, and location. Find detailed information about Minneapolis, St. Paul, Duluth, Rochester, and all other Minnesota cities. Updated directory with population data and city profiles.`,
    keywords: ['Minnesota cities', 'MN cities', 'city directory', 'Minneapolis', 'St. Paul', 'Duluth', 'Rochester', 'Minnesota demographics', 'city population', 'Minnesota locations'],
    openGraph: {
      title: `Minnesota Cities Directory | Complete List of All Cities in MN`,
      description: `Complete directory of all Minnesota cities. Browse cities by population, county, and location. Find detailed information about every city in Minnesota.`,
      url: `${BASE_URL}/explore/cities`,
      siteName: BASE_METADATA.siteName,
      images: [
        {
          ...BASE_METADATA.defaultImage,
          alt: 'Minnesota Cities Directory - Complete List of All Cities in Minnesota',
        },
      ],
      locale: BASE_METADATA.locale,
      type: BASE_METADATA.type,
    },
    twitter: {
      card: 'summary_large_image',
      title: `Minnesota Cities Directory | Complete List of All Cities in MN`,
      description: `Complete directory of all Minnesota cities. Browse cities by population, county, and location.`,
      images: ['/logo.png'],
    },
    alternates: {
      canonical: `${BASE_URL}/explore/cities`,
    },
    robots: getRobotsConfig(),
  };
}

/**
 * Generates metadata for counties list page
 */
export function generateCountiesMetadata(countyCount: number): Metadata {
  return {
    title: `Minnesota Counties Directory | Complete List of All ${countyCount} Counties in MN`,
    description: `Complete directory of all ${countyCount} Minnesota counties. Browse all counties by name, population, and area. Find detailed information about Hennepin County, Ramsey County, Dakota County, and all other Minnesota counties. Updated directory with population data and county profiles.`,
    keywords: ['Minnesota counties', 'MN counties', 'county directory', 'Hennepin County', 'Ramsey County', 'Dakota County', 'Minnesota demographics', 'county population', 'Minnesota geography'],
    openGraph: {
      title: `Minnesota Counties Directory | Complete List of All ${countyCount} Counties in MN`,
      description: `Complete directory of all ${countyCount} Minnesota counties. Browse counties by name, population, and area. Find detailed information about every county in Minnesota.`,
      url: `${BASE_URL}/explore/counties`,
      siteName: BASE_METADATA.siteName,
      images: [
        {
          ...BASE_METADATA.defaultImage,
          alt: 'Minnesota Counties Directory - Complete List of All Counties in Minnesota',
        },
      ],
      locale: BASE_METADATA.locale,
      type: BASE_METADATA.type,
    },
    twitter: {
      card: 'summary_large_image',
      title: `Minnesota Counties Directory | Complete List of All ${countyCount} Counties in MN`,
      description: `Complete directory of all ${countyCount} Minnesota counties. Browse counties by name, population, and area.`,
      images: ['/logo.png'],
    },
    alternates: {
      canonical: `${BASE_URL}/explore/counties`,
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
  const url = `${baseUrl}/explore/city/${slug}`;
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

