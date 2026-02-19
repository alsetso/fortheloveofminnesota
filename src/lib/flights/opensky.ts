export interface FlightState {
  icao24: string;
  callsign: string;
  country: string;
  longitude: number;
  latitude: number;
  baroAltitudeFt: number | null;
  geoAltitudeFt: number | null;
  speedKnots: number | null;
  heading: number;
  onGround: boolean;
  verticalRate: number | null;
  squawk: string | null;
  category: number;
  positionSource: number;
  lastPosition: number | null;
  lastContact: number;
  spi: boolean;
}

export const POSITION_SOURCES: Record<number, string> = {
  0: 'ADS-B',
  1: 'ASTERIX',
  2: 'MLAT',
  3: 'FLARM',
};

export const AIRCRAFT_CATEGORIES: Record<number, string> = {
  0: 'Unknown',
  1: 'No category info',
  2: 'Light (< 15,500 lbs)',
  3: 'Small (15,500–75,000 lbs)',
  4: 'Large (75,000–300,000 lbs)',
  5: 'High Vortex Large',
  6: 'Heavy (> 300,000 lbs)',
  7: 'High Performance (> 5g / 400 kts)',
  8: 'Rotorcraft',
  9: 'Glider / Sailplane',
  10: 'Lighter-than-air',
  11: 'Parachutist / Skydiver',
  12: 'Ultralight / Hang-glider',
  13: 'Reserved',
  14: 'UAV',
  15: 'Space / Transatmospheric',
  16: 'Emergency Vehicle',
  17: 'Service Vehicle',
  18: 'Tethered Balloon',
  19: 'Cluster Obstacle',
  20: 'Line Obstacle',
};

export const EMERGENCY_SQUAWKS: Record<string, { label: string; color: string }> = {
  '7500': { label: 'HIJACK', color: '#ef4444' },
  '7600': { label: 'RADIO FAIL', color: '#f97316' },
  '7700': { label: 'EMERGENCY', color: '#ef4444' },
};

export interface FlightsMeta {
  creditsRemaining: number;
  requestsRemaining: number;
  cacheTTL: number;
  fromCache: boolean;
}

export interface FlightsFetchResult {
  flights: FlightState[];
  meta: FlightsMeta;
  /** Set when API returns 200 but flights are unavailable (e.g. not configured, rate limited). */
  error?: string;
}

function parseMeta(res: Response): FlightsMeta {
  return {
    creditsRemaining: Number(res.headers.get('X-Credits-Remaining') ?? -1),
    requestsRemaining: Number(res.headers.get('X-Requests-Remaining') ?? -1),
    cacheTTL: Number(res.headers.get('X-Cache-TTL') ?? 30),
    fromCache: res.headers.get('X-Served-From-Cache') === '1',
  };
}

export async function fetchMinnesotaFlights(): Promise<FlightsFetchResult> {
  const res = await fetch('/api/flights');

  const meta = parseMeta(res);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error ?? `status ${res.status}`;
    if (res.status === 429) {
      console.warn(`[FlightMap] Rate limited: ${msg}`);
      return { flights: [], meta };
    }
    if (res.status === 502 || res.status === 503) {
      console.warn(`[FlightMap] Flights API unavailable: ${msg}`);
      return { flights: [], meta, error: msg };
    }
    throw new Error(`Flights API error: ${msg}`);
  }

  if (!data.states) {
    const errMsg = data.error ?? 'No flight data';
    console.warn('[FlightMap]', errMsg);
    return { flights: [], meta, error: data.error ?? undefined };
  }

  const flights = (data.states as unknown[][])
    .filter((s) => s[5] != null && s[6] != null)
    .map((s): FlightState => ({
      icao24:         s[0] as string,
      callsign:       ((s[1] as string) ?? '').trim(),
      country:        s[2] as string,
      lastPosition:   s[3] as number | null,
      lastContact:    (s[4] as number) ?? 0,
      longitude:      s[5] as number,
      latitude:       s[6] as number,
      baroAltitudeFt: s[7] != null ? Math.round((s[7] as number) * 3.28084) : null,
      onGround:       (s[8] as boolean) ?? false,
      speedKnots:     s[9] != null ? Math.round((s[9] as number) * 1.94384) : null,
      heading:        (s[10] as number) ?? 0,
      verticalRate:   (s[11] as number) ?? null,
      geoAltitudeFt:  s[13] != null ? Math.round((s[13] as number) * 3.28084) : null,
      squawk:         (s[14] as string) ?? null,
      spi:            (s[15] as boolean) ?? false,
      positionSource: (s[16] as number) ?? 0,
      category:       (s[17] as number) ?? 0,
    }));

  return { flights, meta };
}

export function flightsToGeoJSON(flights: FlightState[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: flights.map(f => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [f.longitude, f.latitude] },
      properties: { ...f },
    })),
  };
}
