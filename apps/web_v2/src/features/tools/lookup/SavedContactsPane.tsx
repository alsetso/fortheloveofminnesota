'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  DockActionRow,
  DockPaneShell,
  DockSection,
  DockSkeletonRows,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  IconArrowLeft,
  IconHome,
  IconMapPin,
  IconUser,
  IconX,
} from '@/features/map/dockCore/core/icons';
import { useAccountPlaces, useAuthSafe, type AccountPlaceAffinity } from '@/features/auth';
import { accountTerritoryKindLabel } from '@/features/accountTerritories/store/constants';
import { useSavedTerritoryMatches } from '@/features/accountTerritories/store/useSavedTerritoryMatches';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { TOOL_FIELD_CLASS, ToolEmptyState, ToolResultRow } from '@/features/tools/core/toolUi';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

type GroupedPlace = {
  key: string;
  territoryUnitId: string | null;
  entity: DockEntity;
  kinds: string[];
};

function groupPlaces(rows: AccountPlaceAffinity[]): GroupedPlace[] {
  const map = new Map<string, GroupedPlace>();
  for (const row of rows) {
    const key = row.territoryUnitId ?? row.entity.id;
    const existing = map.get(key);
    if (existing) {
      if (!existing.kinds.includes(row.kind)) existing.kinds.push(row.kind);
      continue;
    }
    map.set(key, {
      key,
      territoryUnitId: row.territoryUnitId,
      entity: row.entity,
      kinds: [row.kind],
    });
  }
  return [...map.values()];
}

function formatResetDate(iso: string | null): string {
  if (!iso) return 'soon';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'soon';
  }
}

type SavedPerson = {
  id: string;
  display_name: string;
  emails: string[] | null;
  phones: string[] | null;
  linked_account_id?: string | null;
  tag?: string | null;
  avatar_url?: string | null;
  created_at: string;
};

type SavedAddress = {
  id: string;
  label: string;
  city: string | null;
  state: string | null;
  tag?: string | null;
  created_at: string;
};

type BookView = 'hub' | 'people' | 'addresses' | 'places';

function matchesQuery(haystack: string, q: string): boolean {
  if (!q) return true;
  return haystack.toLowerCase().includes(q.toLowerCase());
}

/**
 * Saved contact book — hub (People / Addresses / Places), then filtered lists.
 */
export default function SavedContactsPane({
  initialView = 'hub',
  initialQuery = '',
}: {
  /** Open directly into a list (e.g. Controls → My Places). */
  initialView?: BookView;
  /** Prefill search (e.g. open a tag from the Lists card). */
  initialQuery?: string;
}) {
  const { account } = useAuthSafe();
  const { openSubpage, openDetails } = useMapDock();
  const {
    places,
    isLoading: placesLoading,
    refresh: refreshPlaces,
  } = useAccountPlaces(account?.id);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<SavedPerson[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [removingUnitId, setRemovingUnitId] = useState<string | null>(null);
  const [view, setView] = useState<BookView>(initialView);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const groupedPlaces = useMemo(() => groupPlaces(places), [places]);
  const placeUnitIds = useMemo(
    () => groupedPlaces.map((p) => p.territoryUnitId).filter((id): id is string => Boolean(id)),
    [groupedPlaces],
  );
  const { matches: placeMatches } = useSavedTerritoryMatches(
    view === 'places' || view === 'hub' ? placeUnitIds : [],
  );

  const load = useCallback(async () => {
    if (!account) {
      setPeople([]);
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contacts', { credentials: 'include' });
      const json = (await res.json()) as {
        people?: SavedPerson[];
        addresses?: SavedAddress[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load contacts');
      setPeople(json.people ?? []);
      setAddresses(json.addresses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPeople = useMemo(() => {
    const q = query.trim();
    return people.filter((p) =>
      matchesQuery(
        [p.display_name, p.tag, ...(p.emails ?? []), ...(p.phones ?? [])]
          .filter(Boolean)
          .join(' '),
        q,
      ),
    );
  }, [people, query]);

  const filteredAddresses = useMemo(() => {
    const q = query.trim();
    return addresses.filter((a) =>
      matchesQuery([a.label, a.tag, a.city, a.state].filter(Boolean).join(' '), q),
    );
  }, [addresses, query]);

  const filteredPlaces = useMemo(() => {
    const q = query.trim();
    return groupedPlaces.filter((p) =>
      matchesQuery(
        [
          p.entity.title,
          p.entity.subtitle,
          p.entity.kindLabel,
          ...p.kinds.map((k) => accountTerritoryKindLabel(k)),
        ]
          .filter(Boolean)
          .join(' '),
        q,
      ),
    );
  }, [groupedPlaces, query]);

  const removePlace = useCallback(
    async (place: GroupedPlace) => {
      if (!place.territoryUnitId) {
        setPlaceError('This place can’t be removed from here — open it to manage.');
        return;
      }
      const match = placeMatches[place.territoryUnitId];
      const onlyHomeLocked =
        Boolean(match?.homeLocked) &&
        place.kinds.length === 1 &&
        place.kinds[0] === 'live_here';
      if (onlyHomeLocked) {
        setPlaceError(
          `Home until ${formatResetDate(match?.homeResetAvailableAt ?? null)} — can’t remove yet. Reset from Map layers after that.`,
        );
        return;
      }
      setPlaceError(null);
      setRemovingUnitId(place.territoryUnitId);
      try {
        const res = await fetch('/api/account-territories/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ territoryUnitId: place.territoryUnitId }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setPlaceError(json.error ?? 'Could not remove');
          return;
        }
        refreshPlaces();
      } catch {
        setPlaceError('Could not remove');
      } finally {
        setRemovingUnitId(null);
      }
    },
    [placeMatches, refreshPlaces],
  );

  const hubLoading = loading || placesLoading;
  const nothingSaved =
    !hubLoading &&
    people.length === 0 &&
    addresses.length === 0 &&
    groupedPlaces.length === 0;

  if (!account) {
    return (
      <DockPaneShell>
        <div className="space-y-5 pb-6">
          <DockSection title="Saved">
            <ToolEmptyState
              title="Sign in required"
              subtitle="Your contact book is tied to your account."
            />
          </DockSection>
        </div>
      </DockPaneShell>
    );
  }

  const searchPlaceholder =
    view === 'people'
      ? 'Search people'
      : view === 'addresses'
        ? 'Search addresses'
        : view === 'places'
          ? 'Search places'
          : 'Search your contact book';

  return (
    <DockPaneShell>
      <div className="space-y-5 pb-6">
        {view !== 'hub' ? (
          <button
            type="button"
            onClick={() => {
              setView('hub');
              setQuery('');
            }}
            className="inline-flex items-center gap-1.5 px-0.5 text-[13px] font-semibold text-lake-blue"
          >
            <IconArrowLeft className="h-4 w-4" />
            Contact book
          </button>
        ) : null}

        <div className="space-y-2">
          <label className="sr-only" htmlFor="saved-contacts-search">
            Search{' '}
            {view === 'addresses'
              ? 'addresses'
              : view === 'people'
                ? 'people'
                : view === 'places'
                  ? 'places'
                  : 'contacts'}
          </label>
          <input
            id="saved-contacts-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className={TOOL_FIELD_CLASS}
            autoComplete="off"
          />
        </div>

        {view === 'hub' ? (
          <DockSection
            title="Your contact book"
            subtitle="People, addresses, and places you’ve saved."
          >
            {hubLoading ? <DockSkeletonRows count={3} /> : null}
            {!hubLoading ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setView('people')}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3.5 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lake-blue/10 text-lake-blue">
                    <IconUser className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-foreground">People</span>
                    <span className="mt-0.5 block text-[12px] text-foreground-muted">
                      {people.length} saved
                      {query.trim()
                        ? ` · ${filteredPeople.length} match${filteredPeople.length === 1 ? '' : 'es'}`
                        : ''}
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-lake-blue">Open</span>
                </button>

                <button
                  type="button"
                  onClick={() => setView('addresses')}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3.5 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lake-blue/10 text-lake-blue">
                    <IconHome className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-foreground">
                      Addresses
                    </span>
                    <span className="mt-0.5 block text-[12px] text-foreground-muted">
                      {addresses.length} saved
                      {query.trim()
                        ? ` · ${filteredAddresses.length} match${filteredAddresses.length === 1 ? '' : 'es'}`
                        : ''}
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-lake-blue">Open</span>
                </button>

                <button
                  type="button"
                  onClick={() => setView('places')}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3.5 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lake-blue/10 text-lake-blue">
                    <IconMapPin className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-foreground">Places</span>
                    <span className="mt-0.5 block text-[12px] text-foreground-muted">
                      {groupedPlaces.length} saved
                      {query.trim()
                        ? ` · ${filteredPlaces.length} match${filteredPlaces.length === 1 ? '' : 'es'}`
                        : ''}
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-lake-blue">Open</span>
                </button>
              </div>
            ) : null}

            {nothingSaved ? (
              <ToolEmptyState
                title="Nothing saved yet"
                subtitle="Save people, addresses, or territories from tools, map, or details."
              />
            ) : null}
          </DockSection>
        ) : null}

        {view === 'people' ? (
          <DockSection
            title="People"
            subtitle={`${filteredPeople.length} of ${people.length} · saved from search, records, or owners`}
          >
            {loading ? <DockSkeletonRows count={3} /> : null}
            {!loading && filteredPeople.length === 0 ? (
              <ToolEmptyState
                title={query.trim() ? 'No matching people' : 'No people saved'}
                subtitle={
                  query.trim()
                    ? 'Try a different name, email, phone, or tag.'
                    : 'Open a tool result → pick a person → Confirm → Save.'
                }
              />
            ) : null}
            {!loading
              ? filteredPeople.map((p) => (
                  <ToolResultRow
                    key={p.id}
                    title={p.display_name}
                    subtitle={
                      [
                        p.tag ? `Tag · ${p.tag}` : null,
                        p.linked_account_id
                          ? `Linked account · ${(p.emails?.[0] || p.phones?.[0] || 'FTLOM user') as string}`
                          : ((p.emails?.[0] || p.phones?.[0] || 'Person') as string),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }
                    icon={
                      p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      ) : (
                        <IconUser className="h-5 w-5" />
                      )
                    }
                    onClick={() =>
                      openSubpage({
                        title: p.display_name,
                        subtitle: 'Contact',
                        kind: 'contact-detail',
                        slug: `person:${p.id}`,
                      })
                    }
                  />
                ))
              : null}
            <DockActionRow
              title="Find people"
              subtitle="Name, email, or phone"
              icon={<IconUser className="h-5 w-5" />}
              onClick={() =>
                openSubpage({
                  title: 'People',
                  subtitle: 'Name, email, or phone',
                  kind: 'people',
                })
              }
            />
          </DockSection>
        ) : null}

        {view === 'addresses' ? (
          <DockSection
            title="Addresses"
            subtitle={`${filteredAddresses.length} of ${addresses.length} · map, Find Me, search, or property`}
          >
            {loading ? <DockSkeletonRows count={3} /> : null}
            {!loading && filteredAddresses.length === 0 ? (
              <ToolEmptyState
                title={query.trim() ? 'No matching addresses' : 'No addresses saved'}
                subtitle={
                  query.trim()
                    ? 'Try a different street, city, or tag.'
                    : 'Save an address from search, map, or a property result.'
                }
              />
            ) : null}
            {!loading
              ? filteredAddresses.map((a) => (
                  <ToolResultRow
                    key={a.id}
                    title={a.label}
                    subtitle={
                      [
                        a.tag ? `Tag · ${a.tag}` : null,
                        [a.city, a.state].filter(Boolean).join(', ') || 'Address',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }
                    icon={<IconHome className="h-5 w-5" />}
                    onClick={() =>
                      openSubpage({
                        title: a.label,
                        subtitle: 'Contact',
                        kind: 'contact-detail',
                        slug: `address:${a.id}`,
                      })
                    }
                  />
                ))
              : null}
            <DockActionRow
              title="Look up address"
              subtitle="Property & owner"
              icon={<IconHome className="h-5 w-5" />}
              onClick={() =>
                openSubpage({
                  title: 'Addresses',
                  subtitle: 'Property & owner lookup',
                  kind: 'addresses',
                })
              }
            />
          </DockSection>
        ) : null}

        {view === 'places' ? (
          <DockSection
            title="Places"
            subtitle={`${filteredPlaces.length} of ${groupedPlaces.length} · tap × to remove · home locked 30 days`}
          >
            {placesLoading ? <DockSkeletonRows count={3} /> : null}
            {!placesLoading && filteredPlaces.length === 0 ? (
              <ToolEmptyState
                title={query.trim() ? 'No matching places' : 'No places saved'}
                subtitle={
                  query.trim()
                    ? 'Try a city, county, district, or affinity tag.'
                    : 'Open a territory on the map → save with Live here, Work here, and more.'
                }
              />
            ) : null}
            {!placesLoading
              ? filteredPlaces.map((place) => {
                  const match = place.territoryUnitId
                    ? placeMatches[place.territoryUnitId]
                    : undefined;
                  const homeLocked = Boolean(match?.homeLocked);
                  const onlyHomeLocked =
                    homeLocked &&
                    place.kinds.length === 1 &&
                    place.kinds[0] === 'live_here';
                  const removing = removingUnitId === place.territoryUnitId;
                  const kindLine = place.kinds
                    .map((k) => accountTerritoryKindLabel(k))
                    .join(' · ');
                  const subtitle = [
                    homeLocked
                      ? `Home · locked until ${formatResetDate(match?.homeResetAvailableAt ?? null)}`
                      : match?.isHome
                        ? 'Home'
                        : null,
                    kindLine,
                    place.entity.subtitle ?? place.entity.kind,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <ToolResultRow
                      key={place.key}
                      title={place.entity.title}
                      subtitle={subtitle}
                      icon={<IconMapPin className="h-5 w-5" />}
                      onClick={() => openDetails(place.entity)}
                      trailing={
                        <button
                          type="button"
                          disabled={removing || !place.territoryUnitId || onlyHomeLocked}
                          onClick={(e) => {
                            e.stopPropagation();
                            void removePlace(place);
                          }}
                          aria-label={
                            onlyHomeLocked
                              ? `${place.entity.title} is home-locked`
                              : homeLocked
                                ? `Remove extra tags from ${place.entity.title}`
                                : `Remove ${place.entity.title}`
                          }
                          title={
                            onlyHomeLocked
                              ? `Home locked until ${formatResetDate(match?.homeResetAvailableAt ?? null)}`
                              : homeLocked
                                ? 'Remove extra tags (keeps Live here)'
                                : 'Remove from saved'
                          }
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40 ${
                            onlyHomeLocked
                              ? 'bg-amber-500/10 text-amber-800'
                              : 'bg-map-ink-subtle text-foreground-muted hover:bg-red-500/10 hover:text-red-700'
                          }`}
                        >
                          {removing ? (
                            <span className="text-[11px] font-bold">…</span>
                          ) : (
                            <IconX className="h-4 w-4" />
                          )}
                        </button>
                      }
                    />
                  );
                })
              : null}
            {placeError ? (
              <p className="px-0.5 text-[12px] text-red-600">{placeError}</p>
            ) : null}
          </DockSection>
        ) : null}

        {error ? (
          <button
            type="button"
            onClick={() => void load()}
            className="w-full text-center text-[12px] font-medium text-lake-blue"
          >
            {error} — tap to retry
          </button>
        ) : null}
      </div>
    </DockPaneShell>
  );
}
