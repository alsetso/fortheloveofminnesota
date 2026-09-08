'use client';

/**
 * /discover/places — Apple Settings-style city management.
 * Home is status-only; cities are an inset list; edit via sheet.
 */

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { HOME_RESET_COOLDOWN_DAYS } from '@/features/accountTerritories/store/constants';
import { useAuthSafe } from '@/features/auth';
import { useWarmPlacesInterests } from '@/features/discover/useWarmPlacesInterests';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconPlus,
  IconSpinner,
  IconX,
} from '@/features/map/dockCore/core/icons';
import { useCatalogSelectedIds } from '@/lib/accountInterests/store';
import {
  PLACE_KIND_OPTIONS,
  electHome,
  ensureCityKind,
  followCity,
  homeLockDate,
  homeLockLabel,
  isHomeLocked,
  placeDisplayName,
  removeCity,
  removeCityKind,
  searchCities,
  setCityNotify,
  type AccountPlace,
  type AccountPlaceKind,
  type CitySearchHit,
} from '@/lib/accountPlaces/api';
import { useAccountPlaceRows } from '@/lib/accountPlaces/store';
import { haptic } from '@/lib/despia/haptics';
import { safePadBottom, safePadTop } from '@/lib/despia/safeArea';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';
import { DISCOVER_PATH, directoryTerritoryPath } from '@/lib/routes/routePolicy';

const GROUP = 'overflow-hidden rounded-[10px] bg-white';
const DIVIDER = 'divide-y divide-black/[0.06]';
const FOOTNOTE = 'px-4 pt-2 text-[13px] leading-snug text-[#8E8E93]';
const SECTION =
  'px-4 pb-1.5 pt-6 text-[13px] font-normal uppercase tracking-[0.02em] text-[#8E8E93]';

type CityGroup = {
  unitId: string;
  name: string;
  rows: AccountPlace[];
  kinds: Set<AccountPlaceKind>;
  notify: boolean;
  home: AccountPlace | null;
};

function groupCities(places: AccountPlace[]): CityGroup[] {
  const map = new Map<string, CityGroup>();
  for (const row of places) {
    const unitId = row.territory_unit_id;
    if (!unitId) continue;
    const existing = map.get(unitId);
    if (existing) {
      existing.rows.push(row);
      existing.kinds.add(row.kind);
      existing.notify = existing.notify || row.notify;
      if (row.is_home) existing.home = row;
      continue;
    }
    map.set(unitId, {
      unitId,
      name: row.unit_name?.trim() || placeDisplayName(row),
      rows: [row],
      kinds: new Set([row.kind]),
      notify: row.notify,
      home: row.is_home ? row : null,
    });
  }
  return [...map.values()].sort((a, b) => {
    if (Boolean(a.home) !== Boolean(b.home)) return a.home ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function citySubtitle(city: CityGroup): string {
  const tags = PLACE_KIND_OPTIONS.filter((o) => city.kinds.has(o.id)).map(
    (o) => o.label,
  );
  if (tags.length === 0) return city.notify ? 'Notify on' : 'No relationship yet';
  const base = tags.join(' · ');
  if (!city.notify) return `${base} · Notify off`;
  return base;
}

function SheetShell({
  open,
  title,
  onClose,
  leading,
  trailing,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`fixed inset-0 flex flex-col bg-[#F7F5F1] ${Z_LAYER_CLASS.SHEET}`}
    >
      <header
        className="shrink-0 border-b border-black/[0.08] bg-[#F7F5F1]"
        style={{ paddingTop: safePadTop('0.2rem') }}
      >
        <div className="relative flex h-11 items-center px-2">
          {leading ?? (
            <button
              type="button"
              onClick={() => {
                haptic.toggle();
                onClose();
              }}
              aria-label="Close"
              className="relative z-[1] inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1C1C1E] active:opacity-60"
            >
              <IconX className="h-5 w-5" />
            </button>
          )}
          <h2 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold text-[#1C1C1E]">
            {title}
          </h2>
          {trailing ? (
            <div className="relative z-[1] ml-auto flex min-h-8 min-w-8 items-center justify-end pr-1">
              {trailing}
            </div>
          ) : (
            <div className="ml-auto h-9 w-9" aria-hidden />
          )}
        </div>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4"
        style={{ paddingBottom: safePadBottom('2rem') }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function AddCitySheet({
  open,
  accountId,
  busyKey,
  onClose,
  onAdd,
}: {
  open: boolean;
  accountId: string;
  busyKey: string | null;
  onClose: () => void;
  onAdd: (hit: CitySearchHit) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CitySearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
      setSearching(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      void searchCities(q)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(t);
  }, [open, query]);

  return (
    <SheetShell open={open} title="Add City" onClose={onClose}>
      <div className={`${GROUP} mb-5`}>
        <div className="flex min-h-[44px] items-center gap-3 px-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a Minnesota city"
            autoFocus
            aria-label="Search a Minnesota city"
            className="min-w-0 flex-1 border-0 bg-transparent text-[17px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] [&::-webkit-search-cancel-button]:hidden"
          />
          {searching ? (
            <IconSpinner className="h-4 w-4 shrink-0 text-[#8E8E93]" />
          ) : null}
        </div>
      </div>

      {hits.length > 0 ? (
        <>
          <p className={SECTION.replace('pt-6', 'pt-0')}>Results</p>
          <ul className={`${GROUP} ${DIVIDER}`}>
            {hits.map((hit) => {
              const busy = busyKey === `add:${hit.id}`;
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      haptic.toggle();
                      void onAdd(hit);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-black/[0.04] disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-[17px] text-[#1C1C1E]">
                      {hit.name}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-semibold text-lake-blue">
                      {busy ? (
                        <IconSpinner className="h-4 w-4" />
                      ) : (
                        <>
                          <IconPlus className="h-3.5 w-3.5" />
                          Add
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : query.trim().length >= 2 && !searching ? (
        <p className="px-1 pt-2 text-[15px] leading-snug text-[#8E8E93]">
          No cities matched.
        </p>
      ) : (
        <p className="px-1 pt-2 text-[15px] leading-snug text-[#8E8E93]">
          Search a city to follow, live, or work.
        </p>
      )}
    </SheetShell>
  );
}

function CityDetailSheet({
  open,
  city,
  accountId,
  busyKey,
  onClose,
  onRun,
}: {
  open: boolean;
  city: CityGroup | null;
  accountId: string;
  busyKey: string | null;
  onClose: () => void;
  onRun: (key: string, work: () => Promise<void>) => Promise<void>;
}) {
  if (!city) return null;

  const homeLocked = Boolean(city.home && isHomeLocked(city.home));
  const liveLocked =
    city.kinds.has('live_here') && city.home ? homeLocked : false;
  const canRemove = !homeLocked;

  return (
    <SheetShell
      open={open}
      title={city.name}
      onClose={onClose}
      leading={
        <button
          type="button"
          onClick={() => {
            haptic.toggle();
            onClose();
          }}
          aria-label="Done"
          className="relative z-[1] px-2 py-1.5 text-[16px] font-semibold text-lake-blue active:opacity-70"
        >
          Done
        </button>
      }
      trailing={
        <Link
          href={directoryTerritoryPath(city.unitId)}
          onClick={() => {
            haptic.toggle();
            onClose();
          }}
          className="relative z-[1] px-2 py-1.5 text-[16px] font-semibold text-lake-blue active:opacity-70"
        >
          Open
        </Link>
      }
    >
      <p className={SECTION.replace('pt-6', 'pt-1')}>Relationship</p>
      <ul className={`${GROUP} ${DIVIDER}`}>
        {PLACE_KIND_OPTIONS.map((option) => {
          const on = city.kinds.has(option.id);
          const locked = option.id === 'live_here' && on && liveLocked;
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={Boolean(busyKey) || locked}
                onClick={() => {
                  haptic.toggle();
                  void onRun(`${city.unitId}:${option.id}`, async () => {
                    if (on) {
                      await removeCityKind(accountId, city.unitId, option.id);
                    } else {
                      await ensureCityKind(
                        accountId,
                        city.unitId,
                        option.id,
                        city.name,
                      );
                    }
                  });
                }}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-black/[0.04] disabled:opacity-40"
              >
                <span className="min-w-0 flex-1 text-[17px] text-[#1C1C1E]">
                  {option.label}
                </span>
                {on ? (
                  <IconCheck className="h-5 w-5 shrink-0 text-lake-blue" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <p className={FOOTNOTE}>
        Live, work, or follow — tag how this city relates to you.
        {liveLocked && city.home?.home_locked_until
          ? ` Live stays on while Home is locked (${homeLockLabel(city.home.home_locked_until)}).`
          : null}
      </p>

      <p className={SECTION}>Notifications</p>
      <div className={GROUP}>
        <div className="flex min-h-[44px] items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] text-[#1C1C1E]">Posts in this city</p>
            <p className="mt-0.5 text-[13px] leading-snug text-[#8E8E93]">
              Reports always. Highlights follow Interests.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={city.notify}
            aria-label={`Notify for ${city.name}`}
            disabled={Boolean(busyKey)}
            onClick={() => {
              haptic.toggle();
              void onRun(`${city.unitId}:notify`, async () => {
                await setCityNotify(accountId, city.unitId, !city.notify);
              });
            }}
            className={`relative h-7 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
              city.notify ? 'bg-lake-blue' : 'bg-black/[0.12]'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                city.notify ? 'left-[1.2rem]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {city.kinds.has('live_here') && !city.home ? (
        <>
          <p className={SECTION}>Home</p>
          <div className={GROUP}>
            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={() => {
                haptic.toggle();
                void onRun(`${city.unitId}:home`, async () => {
                  let live = city.rows.find((row) => row.kind === 'live_here');
                  if (!live) {
                    live = await ensureCityKind(
                      accountId,
                      city.unitId,
                      'live_here',
                      city.name,
                    );
                  }
                  await electHome(accountId, live.id);
                });
              }}
              className="flex min-h-[44px] w-full items-center px-4 py-2.5 text-left text-[17px] font-normal text-lake-blue active:bg-black/[0.04] disabled:opacity-40"
            >
              Make Home
            </button>
          </div>
          <p className={FOOTNOTE}>
            Home locks for {HOME_RESET_COOLDOWN_DAYS} days when set.
          </p>
        </>
      ) : null}

      {city.home ? (
        <>
          <p className={SECTION}>Home</p>
          <div className={GROUP}>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[17px] text-[#1C1C1E]">Current home</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    homeLocked
                      ? 'bg-amber-500/15 text-amber-800'
                      : 'bg-lake-blue/10 text-lake-blue'
                  }`}
                >
                  {homeLocked ? 'Locked' : 'On'}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">
                {homeLocked && city.home.home_locked_until
                  ? homeLockLabel(city.home.home_locked_until)
                  : city.home.home_locked_until
                    ? `Can change after ${homeLockDate(city.home.home_locked_until) ?? 'soon'}`
                    : `Locks for ${HOME_RESET_COOLDOWN_DAYS} days when set.`}
              </p>
            </div>
          </div>
        </>
      ) : null}

      <p className={SECTION}> </p>
      <div className={GROUP}>
        <button
          type="button"
          disabled={Boolean(busyKey) || !canRemove}
          onClick={() => {
            haptic.toggle();
            void onRun(`${city.unitId}:remove`, async () => {
              await removeCity(accountId, city.unitId);
              onClose();
            });
          }}
          className="flex min-h-[44px] w-full items-center justify-center px-4 py-2.5 text-[17px] text-red-600 active:bg-black/[0.04] disabled:opacity-40"
        >
          Remove City
        </button>
      </div>
      {!canRemove ? (
        <p className={FOOTNOTE}>
          Home can’t be removed while locked. Change home after the lock ends.
        </p>
      ) : null}
    </SheetShell>
  );
}

/** /discover/places — cities with Live / Work / Follow tags + notify. */
export default function DiscoverPlacesPage() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  useWarmPlacesInterests(accountId);
  const places = useAccountPlaceRows();
  const topics = useCatalogSelectedIds();
  const cities = useMemo(() => groupCities(places), [places]);

  const homeCity = useMemo(
    () => cities.find((city) => city.home) ?? null,
    [cities],
  );
  const homeLocked = Boolean(homeCity?.home && isHomeLocked(homeCity.home));
  const homeUntil =
    homeCity?.home?.home_locked_until &&
    homeLockDate(homeCity.home.home_locked_until);

  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [detailUnitId, setDetailUnitId] = useState<string | null>(null);

  const detailCity = useMemo(
    () => cities.find((c) => c.unitId === detailUnitId) ?? null,
    [cities, detailUnitId],
  );

  // Close detail if city was removed.
  useEffect(() => {
    if (detailUnitId && !detailCity) setDetailUnitId(null);
  }, [detailUnitId, detailCity]);

  const citiesFootnote =
    !accountId
      ? 'Sign in to manage cities.'
      : cities.length === 0
        ? 'Add a city, then set Live, Work, or Follow.'
        : topics.size === 0
          ? 'You’ll get all posts in these cities until you follow topics.'
          : 'Reports always. Highlights and events follow your Interests.';

  const run = async (key: string, work: () => Promise<void>) => {
    if (!accountId || busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <PageScroll>
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
        style={{ paddingTop: safePadTop('0.2rem') }}
      >
        <div className="relative flex h-11 items-center px-2">
          <button
            type="button"
            onClick={() => router.push(DISCOVER_PATH)}
            aria-label="Back to Discover"
            className="relative z-[1] inline-flex h-9 items-center gap-0.5 rounded-full px-1.5 text-lake-blue transition active:opacity-70"
          >
            <IconArrowLeft className="h-5 w-5" />
            <span className="text-[16px] font-semibold">Discover</span>
          </button>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold tracking-tight text-foreground">
            Places
          </h1>
          {accountId ? (
            <button
              type="button"
              onClick={() => {
                haptic.toggle();
                setAddOpen(true);
              }}
              aria-label="Add city"
              className="relative z-[1] ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-lake-blue transition active:bg-black/[0.05]"
            >
              <IconPlus className="h-5 w-5" />
            </button>
          ) : (
            <div className="ml-auto h-9 w-9" aria-hidden />
          )}
        </div>
      </header>

      <div className="px-4 pb-10 pt-1">
        {accountId ? (
          <>
            <p className={SECTION}>Home</p>
            <div className={GROUP}>
              {homeCity ? (
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={directoryTerritoryPath(homeCity.unitId)}
                      className="block truncate text-[17px] font-semibold text-[#1C1C1E]"
                    >
                      {homeCity.name}
                    </Link>
                    <p className="mt-0.5 text-[13px] leading-snug text-[#8E8E93]">
                      {homeLocked && homeUntil
                        ? `Locked until ${homeUntil}. You can change home after that.`
                        : homeUntil
                          ? `Can change after ${homeUntil}.`
                          : `Home locks for ${HOME_RESET_COOLDOWN_DAYS} days when set.`}
                    </p>
                  </div>
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      homeLocked
                        ? 'bg-amber-500/15 text-amber-800'
                        : 'bg-lake-blue/10 text-lake-blue'
                    }`}
                  >
                    {homeLocked ? 'Locked' : 'On'}
                  </span>
                </div>
              ) : (
                <div className="px-4 py-3">
                  <p className="text-[17px] text-[#1C1C1E]">No home yet</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-[#8E8E93]">
                    Add Live on a city, then Make Home. Locks for{' '}
                    {HOME_RESET_COOLDOWN_DAYS} days.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : null}

        <p className={SECTION}>Your Cities</p>
        {cities.length === 0 ? (
          <div className={`${GROUP} px-4 py-6 text-center`}>
            <p className="text-[15px] text-[#8E8E93]">No cities yet</p>
            {accountId ? (
              <button
                type="button"
                onClick={() => {
                  haptic.toggle();
                  setAddOpen(true);
                }}
                className="mt-2 text-[16px] font-semibold text-lake-blue active:opacity-70"
              >
                Add a City
              </button>
            ) : null}
          </div>
        ) : (
          <ul className={`${GROUP} ${DIVIDER}`}>
            {cities.map((city) => (
              <li key={city.unitId}>
                <button
                  type="button"
                  onClick={() => {
                    haptic.toggle();
                    setDetailUnitId(city.unitId);
                  }}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-black/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[17px] text-[#1C1C1E]">
                        {city.name}
                      </span>
                      {city.home ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            isHomeLocked(city.home)
                              ? 'bg-amber-500/15 text-amber-800'
                              : 'bg-lake-blue/10 text-lake-blue'
                          }`}
                        >
                          Home
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-[#8E8E93]">
                      {citySubtitle(city)}
                    </p>
                  </div>
                  <IconChevronRight className="h-4 w-4 shrink-0 text-[#C7C7CC]" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={FOOTNOTE}>{citiesFootnote}</p>

        {error ? (
          <p className="mt-4 px-1 text-[13px] text-red-700">{error}</p>
        ) : null}
      </div>

      {accountId ? (
        <>
          <AddCitySheet
            open={addOpen}
            accountId={accountId}
            busyKey={busyKey}
            onClose={() => setAddOpen(false)}
            onAdd={async (hit) => {
              await run(`add:${hit.id}`, async () => {
                await followCity(accountId, hit.id, hit.name);
                setAddOpen(false);
                setDetailUnitId(hit.id);
              });
            }}
          />
          <CityDetailSheet
            open={Boolean(detailUnitId && detailCity)}
            city={detailCity}
            accountId={accountId}
            busyKey={busyKey}
            onClose={() => setDetailUnitId(null)}
            onRun={run}
          />
        </>
      ) : null}
    </PageScroll>
  );
}
