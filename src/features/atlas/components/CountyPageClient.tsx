'use client';

import LocationPageClient from './LocationPageClient';

interface CountyPageClientProps {
  countyId: string;
  countySlug: string;
}

export default function CountyPageClient({ countyId, countySlug }: CountyPageClientProps) {
  return <LocationPageClient locationId={countyId} locationSlug={countySlug} type="county" />;
}

