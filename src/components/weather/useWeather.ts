import { useQuery } from '@tanstack/react-query';

async function weatherFetch<T>(path: string, extra?: Record<string, string>): Promise<T> {
  const params = new URLSearchParams({ path, ...extra });
  const res = await fetch(`/api/weather?${params}`);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  return res.json();
}

// ---------- Types ----------

export interface AlertProperties {
  event: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  urgency: string;
  certainty: string;
  areaDesc: string;
  headline: string;
  description: string;
  instruction: string | null;
  onset: string;
  ends: string | null;
  expires: string;
  senderName: string;
}

export interface WeatherAlert {
  id: string;
  properties: AlertProperties;
}

export interface ObservationProperties {
  timestamp: string;
  textDescription: string;
  temperature: { value: number | null; unitCode: string };
  dewpoint: { value: number | null; unitCode: string };
  windSpeed: { value: number | null; unitCode: string };
  windDirection: { value: number | null; unitCode: string };
  barometricPressure: { value: number | null; unitCode: string };
  relativeHumidity: { value: number | null; unitCode: string };
  visibility: { value: number | null; unitCode: string };
  windChill: { value: number | null; unitCode: string };
  heatIndex: { value: number | null; unitCode: string };
}

export interface ForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  icon: string;
}

export interface PointMetadata {
  gridId: string;
  gridX: number;
  gridY: number;
  forecastZone: string;
  county: string;
  cwa: string;
  forecast: string;
  forecastHourly: string;
  relativeLocation: {
    properties: {
      city: string;
      state: string;
    };
  };
}

// ---------- Conversions ----------

export function cToF(c: number | null): number | null {
  if (c == null) return null;
  return Math.round(c * 9 / 5 + 32);
}

export function mpsToMph(mps: number | null): number | null {
  if (mps == null) return null;
  return Math.round(mps * 2.23694);
}

export function metersToMiles(m: number | null): number | null {
  if (m == null) return null;
  return +(m / 1609.34).toFixed(1);
}

export function windDegToDir(deg: number | null): string {
  if (deg == null) return '--';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// ---------- Hooks ----------

export function useActiveAlerts() {
  return useQuery({
    queryKey: ['weather', 'alerts', 'MN'],
    queryFn: () =>
      weatherFetch<{ features: WeatherAlert[] }>('/alerts/active', { area: 'MN' }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useLatestObservation(stationId: string) {
  return useQuery({
    queryKey: ['weather', 'observation', stationId],
    queryFn: () =>
      weatherFetch<{ properties: ObservationProperties }>(
        `/stations/${stationId}/observations/latest`
      ),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function usePointMetadata(lat: number, lon: number) {
  return useQuery({
    queryKey: ['weather', 'point', lat, lon],
    queryFn: () =>
      weatherFetch<{ properties: PointMetadata }>(`/points/${lat},${lon}`),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useForecast(gridId: string, gridX: number, gridY: number) {
  return useQuery({
    queryKey: ['weather', 'forecast', gridId, gridX, gridY],
    queryFn: () =>
      weatherFetch<{ properties: { periods: ForecastPeriod[] } }>(
        `/gridpoints/${gridId}/${gridX},${gridY}/forecast`
      ),
    staleTime: 30 * 60 * 1000,
    enabled: !!gridId,
  });
}

export function useHourlyForecast(gridId: string, gridX: number, gridY: number) {
  return useQuery({
    queryKey: ['weather', 'hourly', gridId, gridX, gridY],
    queryFn: () =>
      weatherFetch<{ properties: { periods: ForecastPeriod[] } }>(
        `/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`
      ),
    staleTime: 30 * 60 * 1000,
    enabled: !!gridId,
  });
}
