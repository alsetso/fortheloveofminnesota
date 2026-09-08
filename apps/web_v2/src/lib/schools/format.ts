export function formatSchoolType(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function schoolCatalogSubtitle(
  schoolType: string | null | undefined,
  districtName: string | null | undefined,
): string | null {
  const parts = [formatSchoolType(schoolType), districtName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
