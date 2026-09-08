import type { PostLocationValue } from '@/components/media/capture';

export type ComposePlacePrecision = 'city' | 'exact';

export type ComposePlaceValue = PostLocationValue & {
  unitId: string | null;
  cityName: string | null;
  precision: ComposePlacePrecision;
};

export function composePlaceLabel(place: ComposePlaceValue): string {
  const city = place.cityName?.trim() || null;
  const address = place.address?.trim() || null;
  if (place.precision === 'city' && city) return city;
  if (city && address && !address.toLowerCase().startsWith(city.toLowerCase())) {
    return `${city} · ${shortAddress(address)}`;
  }
  if (address) return shortAddress(address);
  if (city) return city;
  return 'Set location';
}

function shortAddress(address: string): string {
  const first = address.split(',')[0]?.trim();
  return first || address;
}

export function seedComposePlace(seed: PostLocationValue): ComposePlaceValue {
  return {
    ...seed,
    unitId: null,
    cityName: null,
    precision: seed.address?.trim() ? 'exact' : 'city',
  };
}
