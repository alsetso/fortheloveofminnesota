import centroid from '@turf/centroid';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { createClient } from '@/lib/supabase/client';

/** City centroid for compose — pin drops inside the CTU so unit_id resolves. */
export async function fetchCityCentroid(
  unitId: string,
): Promise<{ lat: number; lng: number } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema('territory')
    .from('units')
    .select('geometry_simplified')
    .eq('id', unitId)
    .maybeSingle();
  if (error || !data?.geometry_simplified) return null;
  try {
    const feature: Feature<Polygon | MultiPolygon> = {
      type: 'Feature',
      properties: {},
      geometry: data.geometry_simplified as Polygon | MultiPolygon,
    };
    const [lng, lat] = centroid(feature).geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
