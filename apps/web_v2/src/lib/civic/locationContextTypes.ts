/** Response shape for GET /api/civic/location-context */
export type LocationContextPlace = {
  id: string;
  name: string;
  slug: string | null;
};

export type LocationContextCity = LocationContextPlace & {
  ctu_class: string | null;
};

export type LocationContextResult = {
  county: LocationContextPlace | null;
  /** School district containing the point. */
  district: LocationContextPlace | null;
  city_town: LocationContextCity | null;
};
