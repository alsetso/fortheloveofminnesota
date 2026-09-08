'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import PostLocationPanel, {
  type PostLocationValue,
} from '@/components/media/capture/PostLocationPanel';
import { useAuthSafe } from '@/features/auth';
import {
  listAccountPlaces,
  searchCities,
  type CitySearchHit,
} from '@/lib/accountPlaces/api';
import { useAccountPlaceRows } from '@/lib/accountPlaces/store';
import { fetchCityCentroid } from '@/lib/territory/fetchCityCentroid';
import { fetchTerritoryAtPoint } from '@/lib/territory/fetchTerritoryAtPoint';
import type { ComposePlaceValue } from '@/features/community/compose/composePlace';
import { IconSpinner, IconX } from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';
import { safePadBottom, safePadTop } from '@/lib/despia/safeArea';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

type Tab = 'city' | 'exact';

function ctuFromJurisdictions(
  jurisdictions: { kind: string; id: string; name: string }[],
): { id: string; name: string } | null {
  const ctu = jurisdictions.find((row) => row.kind === 'ctu');
  if (!ctu) return null;
  return { id: ctu.id, name: ctu.name };
}

/**
 * Location manager — City (CTU) or Exact spot (map pin).
 * City is always the alert geography; exact is pin precision.
 */
export function ComposePlaceSheet({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: ComposePlaceValue;
  onChange: (next: ComposePlaceValue) => void;
  onClose: () => void;
}) {
  const { account } = useAuthSafe();
  const places = useAccountPlaceRows();
  const [tab, setTab] = useState<Tab>(value.precision);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CitySearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !account?.id) return;
    void listAccountPlaces(account.id).catch(() => {
      /* chip still works without followed cities */
    });
  }, [open, account?.id]);

  useEffect(() => {
    if (open) setTab(value.precision);
  }, [open, value.precision]);

  useEffect(() => {
    if (!open || tab !== 'city') return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const ac = new AbortController();
    setSearching(true);
    void searchCities(q)
      .then((next) => {
        if (!ac.signal.aborted) setHits(next);
      })
      .catch(() => {
        if (!ac.signal.aborted) setHits([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setSearching(false);
      });
    return () => ac.abort();
  }, [open, query, tab]);

  const followedCities = useMemo(() => {
    const seen = new Set<string>();
    const rows: { id: string; name: string }[] = [];
    for (const place of places) {
      const id = place.territory_unit_id;
      const name = place.name?.trim();
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      rows.push({ id, name });
    }
    return rows.slice(0, 8);
  }, [places]);

  const pickCity = async (city: { id: string; name: string }) => {
    haptic.toggle();
    setBusyId(city.id);
    setError(null);
    try {
      const center = await fetchCityCentroid(city.id);
      if (!center) throw new Error('Could not place that city.');
      onChange({
        lat: center.lat,
        lng: center.lng,
        address: city.name,
        unitId: city.id,
        cityName: city.name,
        precision: 'city',
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set city');
    } finally {
      setBusyId(null);
    }
  };

  const onExactChange = (next: PostLocationValue) => {
    onChange({
      ...value,
      ...next,
      precision: 'exact',
    });
    void (async () => {
      const at = await fetchTerritoryAtPoint(next.lat, next.lng);
      const ctu = at ? ctuFromJurisdictions(at.jurisdictions) : null;
      onChange({
        ...next,
        precision: 'exact',
        unitId: ctu?.id ?? value.unitId,
        cityName: ctu?.name ?? value.cityName,
      });
    })();
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post location"
      className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} flex flex-col bg-white text-[#1C1C1E]`}
      style={{
        paddingTop: safePadTop('0.5rem'),
        paddingBottom: safePadBottom('1rem'),
      }}
    >
      <div className="flex items-center gap-2 px-3 pb-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.08] bg-white/70 transition active:scale-95"
        >
          <IconX className="h-4 w-4" />
        </button>
        <h2 className="flex-1 text-center text-[1.05rem] font-semibold tracking-tight">
          Location
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center justify-center rounded-full bg-lake-blue px-3.5 text-[14px] font-semibold text-white transition active:scale-95"
        >
          Done
        </button>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-5 pb-4">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.05] p-1">
          {(
            [
              { id: 'city' as const, label: 'City' },
              { id: 'exact' as const, label: 'Exact spot' },
            ] as const
          ).map((row) => {
            const on = tab === row.id;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  haptic.toggle();
                  setTab(row.id);
                }}
                className={`h-9 rounded-full text-[13px] font-semibold transition ${
                  on
                    ? 'bg-white text-[#1C1C1E] shadow-sm'
                    : 'text-foreground-muted'
                }`}
              >
                {row.label}
              </button>
            );
          })}
        </div>

        {tab === 'city' ? (
          <div className="mt-4">
            <p className="text-[13px] leading-snug text-foreground-muted">
              Posts alert people who follow this city. Exact map pin is optional.
            </p>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a city"
              aria-label="Find a city"
              className="mt-3 h-11 w-full rounded-2xl border border-black/[0.08] bg-[#F7F5F1] px-3.5 text-[15px] outline-none placeholder:text-foreground-muted/70 focus:border-lake-blue/40"
            />
            {searching ? (
              <div className="mt-4 flex justify-center">
                <IconSpinner className="h-5 w-5 animate-spin text-lake-blue" />
              </div>
            ) : null}
            {query.trim().length >= 2 ? (
              <ul className="mt-3 divide-y divide-black/[0.06]">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      disabled={busyId === hit.id}
                      onClick={() => void pickCity(hit)}
                      className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition active:opacity-70 disabled:opacity-50"
                    >
                      <span className="text-[16px] font-semibold tracking-tight">
                        {hit.name}
                      </span>
                      {busyId === hit.id ? (
                        <IconSpinner className="h-4 w-4 animate-spin text-lake-blue" />
                      ) : value.unitId === hit.id && value.precision === 'city' ? (
                        <span className="text-[12px] font-semibold text-lake-blue">
                          Selected
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
                {hits.length === 0 && !searching ? (
                  <li className="py-6 text-center text-[14px] text-foreground-muted">
                    No cities match.
                  </li>
                ) : null}
              </ul>
            ) : followedCities.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground-muted">
                  Your places
                </p>
                <ul className="mt-1 divide-y divide-black/[0.06]">
                  {followedCities.map((city) => (
                    <li key={city.id}>
                      <button
                        type="button"
                        disabled={busyId === city.id}
                        onClick={() => void pickCity(city)}
                        className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition active:opacity-70 disabled:opacity-50"
                      >
                        <span className="text-[16px] font-semibold tracking-tight">
                          {city.name}
                        </span>
                        {busyId === city.id ? (
                          <IconSpinner className="h-4 w-4 animate-spin text-lake-blue" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-6 text-center text-[14px] text-foreground-muted">
                Search for a Minnesota city.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="mb-3 text-[13px] leading-snug text-foreground-muted">
              Drop a pin. We’ll still tag the city for alerts.
            </p>
            <PostLocationPanel
              value={value}
              onChange={onExactChange}
              tone="light"
              pinHint="Blue pin marks where your post will appear"
            />
          </div>
        )}

        {error ? (
          <p className="mt-3 text-[13px] font-medium text-red-600" role="status">
            {error}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
