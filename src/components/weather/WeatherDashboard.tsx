'use client';

import { useState, useMemo } from 'react';
import {
  useActiveAlerts,
  useLatestObservation,
  usePointMetadata,
  useForecast,
  useHourlyForecast,
  cToF,
  mpsToMph,
  metersToMiles,
  windDegToDir,
} from './useWeather';
import type { WeatherAlert, ForecastPeriod } from './useWeather';
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

// ── MN default: Minneapolis
const DEFAULT_LAT = 44.9778;
const DEFAULT_LON = -93.265;

const SEVERITY_COLORS: Record<string, string> = {
  Extreme: 'bg-red-600 text-white',
  Severe: 'bg-red-500 text-white',
  Moderate: 'bg-amber-500 text-white',
  Minor: 'bg-yellow-400 text-gray-900',
  Unknown: 'bg-gray-400 text-white',
};

const MN_CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'Minneapolis', lat: 44.9778, lon: -93.265 },
  { name: 'St. Paul', lat: 44.9537, lon: -93.09 },
  { name: 'Duluth', lat: 46.7867, lon: -92.1005 },
  { name: 'Rochester', lat: 44.0121, lon: -92.4802 },
  { name: 'Bloomington', lat: 44.8408, lon: -93.2983 },
  { name: 'Brooklyn Park', lat: 45.0941, lon: -93.3563 },
  { name: 'Plymouth', lat: 45.0105, lon: -93.4555 },
  { name: 'Woodbury', lat: 44.9239, lon: -92.9594 },
  { name: 'Maple Grove', lat: 45.0725, lon: -93.4558 },
  { name: 'St. Cloud', lat: 45.5579, lon: -94.1632 },
  { name: 'Eagan', lat: 44.8041, lon: -93.167 },
  { name: 'Eden Prairie', lat: 44.8547, lon: -93.4708 },
  { name: 'Mankato', lat: 44.1636, lon: -93.9994 },
  { name: 'Moorhead', lat: 46.8738, lon: -96.7678 },
  { name: 'Bemidji', lat: 47.4736, lon: -94.8803 },
  { name: 'International Falls', lat: 48.6011, lon: -93.4103 },
  { name: 'Brainerd', lat: 46.358, lon: -94.2008 },
  { name: 'Winona', lat: 44.0499, lon: -91.6393 },
  { name: 'Alexandria', lat: 45.8852, lon: -95.3775 },
  { name: 'Hibbing', lat: 47.4272, lon: -92.9377 },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 dark:bg-white/5 animate-pulse rounded ${className}`} />;
}

// ── Current Conditions Card ──
function CurrentConditions({ stationId, label }: { stationId: string; label: string }) {
  const { data, isLoading, error } = useLatestObservation(stationId);
  const p = data?.properties;

  if (error) {
    return (
      <div className="border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]">
        <p className="text-xs text-red-500">Failed to load {label}</p>
      </div>
    );
  }

  const temp = cToF(p?.temperature?.value ?? null);
  const wind = mpsToMph(p?.windSpeed?.value ?? null);
  const humidity = p?.relativeHumidity?.value;
  const vis = metersToMiles(p?.visibility?.value ?? null);
  const windDir = windDegToDir(p?.windDirection?.value ?? null);
  const windChill = cToF(p?.windChill?.value ?? null);
  const dewpoint = cToF(p?.dewpoint?.value ?? null);

  return (
    <div className="border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px] space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">{label}</p>
        {p?.timestamp && (
          <p className="text-[10px] text-foreground-muted">{formatTime(p.timestamp)}</p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-3 w-full" />
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <span className="text-2xl sm:text-3xl font-semibold text-foreground tabular-nums leading-none">
              {temp != null ? `${temp}°` : '--'}
            </span>
            <span className="text-xs text-foreground-muted pb-0.5 truncate">
              {p?.textDescription || '--'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-1 text-xs">
            <Stat label="Wind" value={wind != null ? `${windDir} ${wind} mph` : '--'} />
            <Stat label="Humidity" value={humidity != null ? `${Math.round(humidity)}%` : '--'} />
            <Stat label="Visibility" value={vis != null ? `${vis} mi` : '--'} />
            <Stat label="Dewpoint" value={dewpoint != null ? `${dewpoint}°F` : '--'} />
            {windChill != null && <Stat label="Wind Chill" value={`${windChill}°F`} />}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-foreground-muted">{label}</span>
      <span className="text-foreground font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ── Alerts Section ──
function AlertsSection() {
  const { data, isLoading } = useActiveAlerts();
  const alerts = data?.features ?? [];
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, WeatherAlert[]>();
    alerts.forEach((a) => {
      const key = a.properties.event;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [alerts]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px] text-center">
        <p className="text-xs text-foreground-muted">No active weather alerts for Minnesota</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {Array.from(grouped).map(([event, items]) => (
        <div key={event} className="border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(expanded === event ? null : event)}
            className="w-full flex items-center gap-2 px-[10px] py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0 text-foreground-muted" />
            <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate">{event}</span>
            <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${SEVERITY_COLORS[items[0].properties.severity] || SEVERITY_COLORS.Unknown}`}>
              {items[0].properties.severity}
            </span>
            <span className="flex-shrink-0 text-[10px] text-foreground-muted tabular-nums">{items.length}</span>
          </button>

          {expanded === event && (
            <div className="border-t border-gray-100 dark:border-white/5 divide-y divide-gray-100 dark:divide-white/5">
              {items.map((a) => (
                <div key={a.id} className="px-[10px] py-2 space-y-1">
                  <p className="text-[10px] font-medium text-foreground">{a.properties.headline}</p>
                  <p className="text-[10px] text-foreground-muted leading-relaxed">
                    {a.properties.areaDesc}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-foreground-muted">
                    {a.properties.onset && <span>From: {formatDate(a.properties.onset)}</span>}
                    {a.properties.ends && <span>Until: {formatDate(a.properties.ends)}</span>}
                  </div>
                  {a.properties.instruction && (
                    <p className="text-[10px] text-foreground-muted italic mt-1">
                      {a.properties.instruction}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Hourly Forecast Row ──
function HourlyRow({ periods }: { periods: ForecastPeriod[] }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
      {periods.map((p) => (
        <div
          key={p.number}
          className="flex-shrink-0 w-[60px] border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface p-1.5 text-center space-y-0.5"
        >
          <p className="text-[10px] text-foreground-muted">{formatTime(p.startTime)}</p>
          <p className="text-sm font-semibold text-foreground tabular-nums">{p.temperature}°</p>
          <p className="text-[10px] text-foreground-muted truncate">{p.shortForecast.split(' ').slice(0, 2).join(' ')}</p>
          <p className="text-[10px] text-foreground-muted">{p.windSpeed}</p>
        </div>
      ))}
    </div>
  );
}

// ── 7-Day Forecast ──
function SevenDay({ periods }: { periods: ForecastPeriod[] }) {
  return (
    <div className="space-y-1">
      {periods.map((p) => (
        <div
          key={p.number}
          className="flex items-center gap-2 sm:gap-3 border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface px-2 sm:px-[10px] py-2"
        >
          <div className="w-16 sm:w-20 flex-shrink-0">
            <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
          </div>
          <div className="w-9 sm:w-10 text-right flex-shrink-0">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {p.temperature}°
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground-muted truncate">{p.shortForecast}</p>
          </div>
          <div className="hidden sm:block flex-shrink-0 text-[10px] text-foreground-muted w-16 text-right">
            {p.windDirection} {p.windSpeed}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── City Search ──
function CitySearch({
  onSelect,
}: {
  onSelect: (city: { name: string; lat: number; lon: number }) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return MN_CITIES;
    const q = query.toLowerCase();
    return MN_CITIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Minnesota cities…"
          className="w-full text-xs pl-8 pr-3 py-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-foreground-muted"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
        {filtered.map((city) => (
          <button
            key={city.name}
            type="button"
            onClick={() => onSelect(city)}
            className="flex items-center gap-1.5 px-2 py-2 sm:py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left min-w-0"
          >
            <MapPinIcon className="w-3 h-3 text-foreground-muted flex-shrink-0" />
            <span className="text-foreground truncate">{city.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Forecast Panel for selected city ──
function CityForecastPanel({ lat, lon, cityName }: { lat: number; lon: number; cityName: string }) {
  const { data: pointData, isLoading: pointLoading } = usePointMetadata(lat, lon);
  const meta = pointData?.properties;

  const { data: forecastData, isLoading: forecastLoading } = useForecast(
    meta?.gridId ?? '',
    meta?.gridX ?? 0,
    meta?.gridY ?? 0
  );

  const { data: hourlyData, isLoading: hourlyLoading } = useHourlyForecast(
    meta?.gridId ?? '',
    meta?.gridX ?? 0,
    meta?.gridY ?? 0
  );

  const loading = pointLoading || forecastLoading || hourlyLoading;
  const forecast7 = forecastData?.properties?.periods ?? [];
  const hourly = hourlyData?.properties?.periods?.slice(0, 24) ?? [];

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-[60px] flex-shrink-0" />
          ))}
        </div>
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <MapPinIcon className="w-3.5 h-3.5 text-foreground-muted flex-shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">{cityName}</h3>
        {meta && (
          <span className="text-[10px] text-foreground-muted hidden sm:inline">
            Grid: {meta.gridId} ({meta.gridX},{meta.gridY})
          </span>
        )}
      </div>

      {hourly.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider mb-1.5">
            Next 24 Hours
          </p>
          <HourlyRow periods={hourly} />
        </div>
      )}

      {forecast7.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider mb-1.5">
            Extended Forecast
          </p>
          <SevenDay periods={forecast7} />
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──
export default function WeatherDashboard() {
  const [selectedCity, setSelectedCity] = useState<{
    name: string;
    lat: number;
    lon: number;
  } | null>(null);

  const activeLat = selectedCity?.lat ?? DEFAULT_LAT;
  const activeLon = selectedCity?.lon ?? DEFAULT_LON;
  const activeName = selectedCity?.name ?? 'Minneapolis';

  const { data: pointData } = usePointMetadata(activeLat, activeLon);
  const meta = pointData?.properties;

  const { data: forecastData, isLoading: forecastLoading } = useForecast(
    meta?.gridId ?? '',
    meta?.gridX ?? 0,
    meta?.gridY ?? 0
  );

  const { data: hourlyData, isLoading: hourlyLoading } = useHourlyForecast(
    meta?.gridId ?? '',
    meta?.gridX ?? 0,
    meta?.gridY ?? 0
  );

  const forecast7 = forecastData?.properties?.periods ?? [];
  const hourly = hourlyData?.properties?.periods?.slice(0, 24) ?? [];

  return (
    <div className="max-w-7xl mx-auto w-full px-2 sm:px-[10px] py-3 pb-24 sm:pb-3 space-y-3">
      {/* Header */}
      <div className="flex-shrink-0 pt-4 pb-2 sm:pt-6 sm:pb-3 text-center">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          Minnesota Weather
        </h1>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1 max-w-md mx-auto">
          Live conditions, forecasts, and alerts across the state.
        </p>
      </div>

      {/* Current Conditions — 3 key stations */}
      <div>
        <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider mb-1.5">
          Current Conditions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <CurrentConditions stationId="KMSP" label="Minneapolis (KMSP)" />
          <CurrentConditions stationId="KDLH" label="Duluth (KDLH)" />
          <CurrentConditions stationId="KRST" label="Rochester (KRST)" />
        </div>
      </div>

      {/* Active Alerts */}
      <div>
        <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider mb-1.5">
          Active Alerts
        </p>
        <AlertsSection />
      </div>

      {/* Hourly for active city */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">
            Hourly — {activeName}
          </p>
          {selectedCity && (
            <button
              type="button"
              onClick={() => setSelectedCity(null)}
              className="flex items-center gap-1 text-[10px] text-foreground-muted hover:text-foreground transition-colors"
            >
              <ArrowPathIcon className="w-3 h-3" />
              Reset to Minneapolis
            </button>
          )}
        </div>
        {hourlyLoading ? (
          <div className="flex gap-1.5 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-[60px] flex-shrink-0" />
            ))}
          </div>
        ) : (
          <HourlyRow periods={hourly} />
        )}
      </div>

      {/* 7-Day Forecast */}
      <div>
        <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider mb-1.5">
          7-Day Forecast — {activeName}
        </p>
        {forecastLoading ? (
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <SevenDay periods={forecast7} />
        )}
      </div>

      {/* City Search */}
      <div>
        <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider mb-1.5">
          City Lookup
        </p>
        <div className="border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]">
          <CitySearch onSelect={setSelectedCity} />
        </div>
      </div>

      {/* Selected City Forecast */}
      {selectedCity && (
        <div className="border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]">
          <CityForecastPanel
            lat={selectedCity.lat}
            lon={selectedCity.lon}
            cityName={selectedCity.name}
          />
        </div>
      )}
    </div>
  );
}
