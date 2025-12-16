import { createServerClient } from '@/lib/supabaseServer';
import FeedMapClient from '@/components/feed/FeedMapClient';
import { cache } from 'react';

// Configure route segment for optimal caching
export const dynamic = 'force-dynamic'; // Feed content changes frequently
export const revalidate = 60; // Revalidate cities/counties every 60 seconds

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function formatArea(area: number): string {
  return `${formatNumber(area)} sq mi`;
}

// Cache cities and counties data - these change infrequently
const getCitiesData = cache(async () => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, slug, population, county')
    .order('population', { ascending: false });
  
  if (error) {
    console.error('Error fetching cities:', error);
  }
  
  return data || [];
});

const getCountiesData = cache(async () => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('counties')
    .select('id, name, slug, population, area_sq_mi')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching counties:', error);
  }
  
  return data || [];
});

export default async function FeedPage() {
  // Fetch cities and counties in parallel with caching
  const [citiesData, countiesData] = await Promise.all([
    getCitiesData(),
    getCountiesData(),
  ]);


  type CityData = {
    id: number;
    name: string;
    slug: string | null;
    population: number;
    county: string | null;
  };

  type CountyData = {
    id: number;
    name: string;
    slug: string | null;
    population: number;
    area_sq_mi: number | null;
  };

  const cities = (citiesData as CityData[])
    .filter((city): city is CityData & { slug: string } => !!city.slug)
    .map(city => ({
      id: String(city.id),
      name: city.name,
      slug: city.slug,
      population: formatNumber(city.population),
      county: city.county ?? '',
    }));

  const counties = (countiesData as CountyData[])
    .filter((county): county is CountyData & { slug: string } => !!county.slug)
    .map(county => ({
      id: String(county.id),
      name: county.name,
      slug: county.slug,
      population: formatNumber(county.population),
      area: formatArea(county.area_sq_mi ?? 0),
    }));

  return (
    <FeedMapClient cities={cities} counties={counties} />
  );
}


