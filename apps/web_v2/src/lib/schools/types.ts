/** One row from the statewide K–12 school catalog (`territory.schools`). */
export type SchoolCatalogRow = {
  id: string;
  name: string;
  slug: string | null;
  schoolType: string | null;
  schoolDistrictId: string | null;
  districtName: string | null;
  subtitle: string | null;
  lat: number | null;
  lng: number | null;
};

export type SchoolCatalogResponse = {
  rows: SchoolCatalogRow[];
  total: number;
  offset: number;
  limit: number;
};
