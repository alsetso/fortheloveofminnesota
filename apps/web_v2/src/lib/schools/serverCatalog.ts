import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';
import { formatSchoolType, schoolCatalogSubtitle } from '@/lib/schools/format';
import type { SchoolCatalogRow } from '@/lib/schools/types';

type SchoolRow = {
  id: string;
  name: string;
  slug: string | null;
  school_type: string | null;
  school_district_id: string | null;
  lat: number | null;
  lng: number | null;
};

export function escapeSchoolIlike(q: string): string {
  return q.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

export async function loadSchoolDistrictNames(
  districtIds: string[],
): Promise<Map<string, string>> {
  const districtNameById = new Map<string, string>();
  if (districtIds.length === 0) return districtNameById;

  const db = createTerritoryServerClient();
  const { data: districts } = await db
    .from('school_districts')
    .select('id, name')
    .in('id', districtIds);
  for (const d of districts ?? []) {
    if (d?.id && d?.name) districtNameById.set(String(d.id), String(d.name));
  }
  return districtNameById;
}

export function mapSchoolCatalogRows(
  schools: SchoolRow[],
  districtNameById: Map<string, string>,
): SchoolCatalogRow[] {
  return schools.map((school) => {
    const schoolType = formatSchoolType(school.school_type);
    const districtName = school.school_district_id
      ? (districtNameById.get(school.school_district_id) ?? null)
      : null;
    return {
      id: String(school.id),
      name: String(school.name ?? ''),
      slug: school.slug != null ? String(school.slug) : null,
      schoolType,
      schoolDistrictId: school.school_district_id,
      districtName,
      subtitle: schoolCatalogSubtitle(schoolType, districtName),
      lat: typeof school.lat === 'number' && Number.isFinite(school.lat) ? school.lat : null,
      lng: typeof school.lng === 'number' && Number.isFinite(school.lng) ? school.lng : null,
    };
  });
}

export async function querySchoolCatalog(params: {
  q?: string;
  offset: number;
  limit: number;
}): Promise<{ rows: SchoolCatalogRow[]; total: number }> {
  const db = createTerritoryServerClient();
  const q = params.q?.trim() ?? '';

  let query = db
    .from('schools')
    .select('id, name, slug, school_type, school_district_id, lat, lng', {
      count: 'exact',
    })
    .order('name', { ascending: true });

  if (q.length >= 1) {
    query = query.ilike('name', `%${escapeSchoolIlike(q)}%`);
  }

  const { data, error, count } = await query.range(
    params.offset,
    params.offset + params.limit - 1,
  );
  if (error) throw error;

  const schools = (data ?? []) as SchoolRow[];
  const districtIds = [
    ...new Set(
      schools
        .map((school) => school.school_district_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const districtNameById = await loadSchoolDistrictNames(districtIds);

  return {
    rows: mapSchoolCatalogRows(schools, districtNameById),
    total: count ?? schools.length,
  };
}
