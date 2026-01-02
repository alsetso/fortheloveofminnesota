const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Generates breadcrumb structured data for SEO
 * @param items - Array of breadcrumb items (name, url)
 * @returns JSON-LD structured data object
 */
export function generateBreadcrumbStructuredData(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generates collection page structured data for cities directory
 */
export function generateCitiesStructuredData(
  cities: Array<{ id: string; name: string; slug: string; population: number; county: string | null }>,
  totalPopulation: number
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Minnesota Cities Directory',
    description: `Complete directory of all ${cities.length} cities in Minnesota with population data and city profiles.`,
    url: `${BASE_URL}/explore/cities`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: cities.length,
      itemListElement: cities.slice(0, 50).map((city, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'City',
          name: city.name,
          url: `${BASE_URL}/explore/city/${city.slug}`,
          population: city.population,
          containedInPlace: city.county ? {
            '@type': 'County',
            name: city.county,
          } : undefined,
        },
      })),
    },
    about: {
      '@type': 'State',
      name: 'Minnesota',
      '@id': 'https://www.wikidata.org/wiki/Q1527',
    },
    statistics: {
      '@type': 'StatisticalPopulation',
      populationTotal: totalPopulation,
      numberOfItems: cities.length,
    },
  };
}

/**
 * Generates collection page structured data for counties directory
 */
export function generateCountiesStructuredData(
  counties: Array<{ id: string; name: string; slug: string | null; population: number; area_sq_mi: number | null }>,
  totalPopulation: number,
  totalArea: number
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Minnesota Counties Directory',
    description: `Complete directory of all ${counties.length} counties in Minnesota with population data, area information, and county profiles.`,
    url: `${BASE_URL}/explore/counties`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: counties.length,
      itemListElement: counties
        .filter(c => c.slug !== null)
        .slice(0, 50)
        .map((county, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'County',
            name: county.name,
            url: `${BASE_URL}/explore/county/${county.slug}`,
            population: county.population,
            area: county.area_sq_mi ? {
              '@type': 'QuantitativeValue',
              value: county.area_sq_mi,
              unitCode: 'MI2',
            } : undefined,
          },
        })),
    },
    about: {
      '@type': 'State',
      name: 'Minnesota',
      '@id': 'https://www.wikidata.org/wiki/Q1527',
    },
    statistics: {
      '@type': 'StatisticalPopulation',
      populationTotal: totalPopulation,
      numberOfItems: counties.length,
      areaTotal: totalArea,
    },
  };
}

/**
 * Generates collection page structured data for explore page
 */
export function generateExploreStructuredData(
  cityCount: number,
  countyCount: number,
  favoriteCounties: Array<{ name: string; slug: string | null; website_url: string | null }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Explore Minnesota - Cities and Counties Directory',
    description: `Comprehensive directory of ${countyCount} Minnesota counties and ${cityCount} cities with population data, geographic information, official websites, and detailed location profiles.`,
    url: `${BASE_URL}/explore`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: 2,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          item: {
            '@type': 'CollectionPage',
            name: 'Minnesota Cities Directory',
            url: `${BASE_URL}/explore/cities`,
            description: `Complete directory of all ${cityCount} cities in Minnesota`,
          },
        },
        {
          '@type': 'ListItem',
          position: 2,
          item: {
            '@type': 'CollectionPage',
            name: 'Minnesota Counties Directory',
            url: `${BASE_URL}/explore/counties`,
            description: `Complete directory of all ${countyCount} counties in Minnesota`,
          },
        },
      ],
    },
    about: {
      '@type': 'State',
      name: 'Minnesota',
      '@id': 'https://www.wikidata.org/wiki/Q1527',
      sameAs: 'https://en.wikipedia.org/wiki/Minnesota',
    },
    hasPart: favoriteCounties
      .filter(c => c.slug !== null)
      .slice(0, 10)
      .map((county) => ({
        '@type': 'County',
        name: county.name,
        url: `${BASE_URL}/explore/county/${county.slug}`,
        ...(county.website_url && { sameAs: county.website_url }),
      })),
  };
}


