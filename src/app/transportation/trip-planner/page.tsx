'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import TransportSubNav from '@/components/sub-nav/TransportSubNav';
import {
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Suggestion {
  text: string;
  magic_key: string;
  geolocator: number;
}

interface ResolvedLocation {
  description: string;
  point: { x: number; y: number };
}

interface StopData {
  description: string;
  area: string;
  lat: number;
  long: number;
  time: string;
  date: string;
  stopid: number;
  accessible: string;
}

interface LegService {
  route: number;
  publicroute: string;
  sign: string;
  operator: string;
  routetype: string;
}

interface LegFare {
  legregularfare: number;
  legreducedfare: number;
}

interface Leg {
  onwalkdist: number;
  onstop: string;
  ontime: string;
  onstopdata: StopData;
  offstop: string;
  offtime: string;
  offstopdata: StopData;
  service: LegService;
  fare: LegFare;
}

interface Itinerary {
  legs: Leg[];
  transittime: number;
  totalwalk: number;
  regularfare: number;
  reducedfare: number;
}

interface PlanResponse {
  responsecode: number;
  tripplanfaultcode: number;
  input: Record<string, unknown>;
  itin?: Itinerary[];
  walkable?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(hhmm: string): string {
  const h = parseInt(hhmm.slice(0, -2), 10);
  const m = hhmm.slice(-2);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

const SCHEDULE_HORIZON_WEEKS = 6;

function maxScheduleDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + SCHEDULE_HORIZON_WEEKS * 7);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function faultMessage(code: number, walkdist: number): string {
  switch (code) {
    case 20006:
      return `Date is beyond the published schedule window (~${SCHEDULE_HORIZON_WEEKS} weeks). Choose a closer date.`;
    case 20008:
      return 'No transit service at this time. Most routes stop between ~1 AM and 4 AM. Try a different time.';
    case 20003:
      return `No stops within ${walkdist} mi of your origin. Increase "Max walk" distance or pick a location closer to a transit stop.`;
    case 15018:
      return 'Location is outside the Metro Transit service area (Twin Cities metro only).';
    case 11085:
      return 'Origin and destination are close enough to walk — no transit trip needed.';
    default:
      return 'No trips found. Try a different time, increase walk distance, or check that both locations are within the Twin Cities metro.';
  }
}

function routeTypeBadge(routetype: string): { label: string; cls: string } {
  switch (routetype) {
    case 'L':
      return { label: 'Rail', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    case 'E':
      return { label: 'Express', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
    default:
      return { label: 'Bus', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
  }
}

// ---------------------------------------------------------------------------
// LocationInput — autocomplete using suggest + findaddress
// ---------------------------------------------------------------------------

function LocationInput({
  label,
  placeholder,
  value,
  onResolved,
}: {
  label: string;
  placeholder: string;
  value: ResolvedLocation | null;
  onResolved: (loc: ResolvedLocation | null) => void;
}) {
  const [text, setText] = useState(value?.description ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setText(value.description);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await fetch(
        `/api/transportation/tripplanner/suggest?text=${encodeURIComponent(q)}`,
        { signal: abortRef.current.signal },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setOpen(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setText(val);
    onResolved(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const handleSelect = async (s: Suggestion) => {
    setText(s.text);
    setOpen(false);
    setSuggestions([]);
    try {
      const res = await fetch(
        `/api/transportation/tripplanner/findaddress?magicKey=${encodeURIComponent(s.magic_key)}&geolocator=${s.geolocator}`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      onResolved({ description: s.text, point: { x: data.x, y: data.y } });
    } catch {
      onResolved(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider mb-0.5 block">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
          <MapPinIcon className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          placeholder={placeholder}
          className="w-full py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-foreground-muted bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
            <div className="w-3 h-3 border-[1.5px] border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}
        {value && !loading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-0.5 bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={`${s.magic_key}-${i}`}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-foreground-muted hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors truncate"
            >
              {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Itinerary display
// ---------------------------------------------------------------------------

function ItineraryCard({ itin, index }: { itin: Itinerary; index: number }) {
  const firstLeg = itin.legs[0];
  const lastLeg = itin.legs[itin.legs.length - 1];
  const departTime = firstLeg?.ontime;
  const arriveTime = lastLeg?.offtime;
  const transfers = itin.legs.length - 1;

  return (
    <div className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface">
      {/* Summary bar */}
      <div className="flex items-center justify-between p-[10px] border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium text-gray-400 dark:text-foreground-subtle">
            Option {index + 1}
          </span>
          <span className="text-xs font-medium text-gray-900 dark:text-foreground">
            {departTime ? formatTime(departTime) : '—'} → {arriveTime ? formatTime(arriveTime) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-foreground-muted">
          <span className="flex items-center gap-1">
            <ClockIcon className="w-3 h-3" />
            {itin.transittime} min
          </span>
          {transfers > 0 && (
            <span>{transfers} transfer{transfers > 1 ? 's' : ''}</span>
          )}
          <span>${itin.regularfare.toFixed(2)}</span>
        </div>
      </div>

      {/* Legs */}
      <div className="p-[10px] space-y-1">
        {itin.legs.map((leg, li) => {
          const badge = routeTypeBadge(leg.service.routetype);
          return (
            <div key={li}>
              {/* Walk to stop (if any) */}
              {leg.onwalkdist > 0 && (
                <div className="flex items-center gap-2 py-1 text-[10px] text-gray-400 dark:text-foreground-subtle">
                  <div className="w-3.5 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
                  </div>
                  <span>Walk {leg.onwalkdist.toFixed(1)} mi to {leg.onstop}</span>
                </div>
              )}

              {/* Transit leg */}
              <div className="flex items-start gap-2 py-1">
                <div className="w-3.5 flex items-center justify-center pt-0.5">
                  <div className={`w-2 h-2 rounded-full ${
                    leg.service.routetype === 'L' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${badge.cls}`}>
                      {leg.service.publicroute}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-foreground-muted truncate">
                      {leg.service.sign}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-foreground-muted">
                    <span className="font-medium">{formatTime(leg.ontime)}</span>
                    <span className="text-gray-400 dark:text-foreground-subtle">{leg.onstop}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-foreground-muted">
                    <span className="font-medium">{formatTime(leg.offtime)}</span>
                    <span className="text-gray-400 dark:text-foreground-subtle">{leg.offstop}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TripPlannerPage() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);
  const [origin, setOrigin] = useState<ResolvedLocation | null>(null);
  const [destination, setDestination] = useState<ResolvedLocation | null>(null);
  const [datetime, setDatetime] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [arrdep, setArrdep] = useState<'D' | 'A'>('D');
  const [walkdist, setWalkdist] = useState(0.5);
  const [minimize, setMinimize] = useState<'T' | 'X' | 'W'>('T');
  const [accessible, setAccessible] = useState(false);

  const [planning, setPlanning] = useState(false);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPlan = origin !== null && destination !== null;

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
    setResult(null);
  };

  const handlePlan = async () => {
    if (!canPlan) return;
    setPlanning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/transportation/tripplanner/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { description: origin.description, point: origin.point },
          destination: { description: destination.description, point: destination.point },
          datetime: datetime + ':00',
          arrdep,
          walkdist,
          minimize,
          accessible,
        }),
      });

      if (!res.ok) throw new Error(`${res.status}`);
      const data: PlanResponse = await res.json();

      if (!data.itin?.length) {
        setError(faultMessage(data.tripplanfaultcode ?? 0, walkdist));
      } else {
        setResult(data);
      }
    } catch {
      setError('Failed to plan trip. Try again.');
    } finally {
      setPlanning(false);
    }
  };

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<TransportSubNav />}
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      subSidebarLabel="Transport"
      rightSidebar={<RightSidebar />}
    >
      <div className="p-4 space-y-3 max-w-3xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-foreground">Trip Planner</h1>
          <p className="text-xs text-gray-500 dark:text-foreground-muted">
            Plan transit trips across the Twin Cities metro — powered by Metro Transit
          </p>
        </div>

        {/* Form */}
        <div className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface p-[10px] space-y-2">
          {/* From / To */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <LocationInput
                label="From"
                placeholder="Address, landmark, or stop..."
                value={origin}
                onResolved={setOrigin}
              />
              <LocationInput
                label="To"
                placeholder="Address, landmark, or stop..."
                value={destination}
                onResolved={setDestination}
              />
            </div>
            <button
              type="button"
              onClick={handleSwap}
              className="mb-1 w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors text-gray-500 dark:text-foreground-muted flex-shrink-0"
              aria-label="Swap origin and destination"
            >
              <ArrowsRightLeftIcon className="w-3.5 h-3.5 rotate-90" />
            </button>
          </div>

          {/* Date/time + options row */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px]">
              <label className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider mb-0.5 block">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                max={maxScheduleDate()}
                className="w-full py-1.5 px-2 text-xs text-foreground bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider mb-0.5 block">
                &nbsp;
              </label>
              <select
                value={arrdep}
                onChange={(e) => setArrdep(e.target.value as 'D' | 'A')}
                className="py-1.5 px-2 text-xs text-foreground bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
              >
                <option value="D">Depart at</option>
                <option value="A">Arrive by</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider mb-0.5 block">
                Optimize
              </label>
              <select
                value={minimize}
                onChange={(e) => setMinimize(e.target.value as 'T' | 'X' | 'W')}
                className="py-1.5 px-2 text-xs text-foreground bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
              >
                <option value="T">Fastest</option>
                <option value="X">Fewest transfers</option>
                <option value="W">Least walking</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider mb-0.5 block">
                Max walk
              </label>
              <select
                value={walkdist}
                onChange={(e) => setWalkdist(Number(e.target.value))}
                className="py-1.5 px-2 text-xs text-foreground bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
              >
                <option value={0.25}>¼ mi</option>
                <option value={0.5}>½ mi</option>
                <option value={0.75}>¾ mi</option>
                <option value={1}>1 mi</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 py-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={accessible}
                onChange={(e) => setAccessible(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-white/20 text-blue-600 focus:ring-1 focus:ring-gray-300"
              />
              <span className="text-[10px] text-gray-600 dark:text-foreground-muted">Accessible</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="button"
            disabled={!canPlan || planning}
            onClick={handlePlan}
            className={`w-full py-2 text-xs font-medium rounded-md transition-colors ${
              canPlan && !planning
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-foreground-subtle cursor-not-allowed'
            }`}
          >
            {planning ? 'Planning...' : 'Plan Trip'}
          </button>
        </div>

        {/* Results */}
        {error && (
          <div className="p-[10px] rounded-md border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-400">
            {error}
          </div>
        )}

        {result?.itin && result.itin.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider">
              {result.itin.length} itinerar{result.itin.length === 1 ? 'y' : 'ies'}
            </p>
            {result.itin.map((itin, i) => (
              <ItineraryCard key={i} itin={itin} index={i} />
            ))}
          </div>
        )}
      </div>
    </NewPageWrapper>
  );
}
