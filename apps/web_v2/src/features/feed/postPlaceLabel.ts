/**
 * Feed / post place line — city + zip only (never street-level address).
 * Prefer territory unit labels; fall back to parsing city/ZIP from full_address.
 */

export type PostPlaceBits = {
  /** Display line, e.g. "Orono · 55356". Null when we have nothing safe to show. */
  label: string | null;
  cityName: string | null;
  zipCode: string | null;
  unitId: string | null;
  zipcodeId: string | null;
};

export function buildPostPlaceBits(input: {
  unitId?: string | null;
  zipcodeId?: string | null;
  cityName?: string | null;
  zipCode?: string | null;
  fullAddress?: string | null;
}): PostPlaceBits {
  const unitId = input.unitId?.trim() || null;
  const zipcodeId = input.zipcodeId?.trim() || null;
  let cityName = input.cityName?.trim() || null;
  let zipCode = input.zipCode?.trim() || null;

  if (!cityName || !zipCode) {
    const parsed = cityZipFromFullAddress(input.fullAddress);
    if (!cityName) cityName = parsed.city;
    if (!zipCode) zipCode = parsed.zip;
  }

  // Never surface street-only / landmark-only strings as the place line.
  const label =
    cityName && zipCode
      ? `${cityName} · ${zipCode}`
      : cityName
        ? cityName
        : zipCode
          ? zipCode
          : null;

  return { label, cityName, zipCode, unitId, zipcodeId };
}

/** Pull city + ZIP from a US/MN style address; ignore street / place names. */
export function cityZipFromFullAddress(address: string | null | undefined): {
  city: string | null;
  zip: string | null;
} {
  const raw = address?.trim() || '';
  if (!raw) return { city: null, zip: null };

  const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch?.[1] ?? null;

  const cityState = raw.match(
    /,\s*([^,]+?)\s*,\s*(?:Minnesota|MN)\b/i,
  );
  let city = cityState?.[1]?.trim() || null;

  if (!city) {
    // "City MN 55420" / "City, MN 55420"
    const loose = raw.match(
      /^([^,]+?)\s*,?\s*(?:Minnesota|MN)\s+\d{5}/i,
    );
    city = loose?.[1]?.trim() || null;
  }

  // Reject values that look like street lines (number + street, or no city signal).
  if (city && /^\d/.test(city)) city = null;

  return { city, zip };
}
