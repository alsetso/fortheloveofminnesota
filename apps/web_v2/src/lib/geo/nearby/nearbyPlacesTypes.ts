/** Shared nearby-POI hit for dock carousel + API. */

export type NearbyPlaceHit = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  /** Meters from the query point (Mapbox). */
  distanceM: number;
  /** Square static-map preview URL. */
  imageUrl: string;
};
