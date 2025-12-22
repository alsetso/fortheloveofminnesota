'use client';

import LocationPageClient from './LocationPageClient';

interface CityPageClientProps {
  cityId: string;
  citySlug: string;
}

export default function CityPageClient({ cityId, citySlug }: CityPageClientProps) {
  return <LocationPageClient locationId={cityId} locationSlug={citySlug} type="city" />;
}

