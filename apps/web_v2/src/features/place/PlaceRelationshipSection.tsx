'use client';

/**
 * Inline Live / Work / Follow + notify for a CTU place record.
 * Always available (not passport-gated) — same product rules as Discover Places.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthSafe } from '@/features/auth';
import { useWarmPlacesInterests } from '@/features/discover/useWarmPlacesInterests';
import {
  PLACE_KIND_OPTIONS,
  electHome,
  ensureCityKind,
  homeLockDate,
  homeLockLabel,
  isHomeLocked,
  removeCity,
  removeCityKind,
  setCityNotify,
  type AccountPlace,
  type AccountPlaceKind,
} from '@/lib/accountPlaces/api';
import { useAccountPlaceRows } from '@/lib/accountPlaces/store';
import { DISCOVER_PLACES_PATH } from '@/lib/routes/routePolicy';

type PlaceRelationshipSectionProps = {
  unitId: string;
  unitName: string;
  /** Only CTUs participate in product Places. */
  enabled: boolean;
};

export function PlaceRelationshipSection({
  unitId,
  unitName,
  enabled,
}: PlaceRelationshipSectionProps) {
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  useWarmPlacesInterests(accountId);
  const places = useAccountPlaceRows();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => places.filter((row) => row.territory_unit_id === unitId),
    [places, unitId],
  );
  const kinds = useMemo(() => new Set(rows.map((row) => row.kind)), [rows]);
  const home = useMemo(
    () => rows.find((row) => row.is_home) ?? null,
    [rows],
  );
  const notify = rows.some((row) => row.notify);
  const hasAny = rows.length > 0;
  const homeLocked = Boolean(home && isHomeLocked(home));

  if (!enabled) return null;

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
    <section className="space-y-3 border-t border-black/[0.06] pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            Your place
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-foreground-muted">
            {accountId
              ? hasAny
                ? 'Live, work, or follow — and whether posts can reach you.'
                : 'Tag how this city relates to you.'
              : 'Sign in to save Live, Work, or Follow.'}
          </p>
        </div>
        {home ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              homeLocked
                ? 'bg-amber-500/15 text-amber-800'
                : 'bg-lake-blue/10 text-lake-blue'
            }`}
          >
            Home
          </span>
        ) : null}
      </div>

      {!accountId ? (
        <p className="text-[14px] text-foreground-muted">Sign in to manage.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PLACE_KIND_OPTIONS.map((option) => {
              const on = kinds.has(option.id);
              const liveLocked =
                option.id === 'live_here' && on && homeLocked;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  disabled={Boolean(busyKey) || liveLocked}
                  onClick={() =>
                    void run(option.id, async () => {
                      if (on) {
                        await removeCityKind(accountId, unitId, option.id);
                      } else {
                        await ensureCityKind(
                          accountId,
                          unitId,
                          option.id,
                          unitName,
                        );
                      }
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition disabled:opacity-40 ${
                    on
                      ? 'border-lake-blue/40 bg-lake-blue/10 text-lake-blue'
                      : 'border-black/[0.1] bg-transparent text-foreground-muted'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {hasAny ? (
            <div className="flex items-center justify-between gap-3 py-0.5">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-foreground">
                  Posts in this city
                </p>
                <p className="text-[12px] text-foreground-muted">
                  Reports always. Highlights & events follow Interests.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notify}
                aria-label="Notify for posts in this city"
                disabled={Boolean(busyKey)}
                onClick={() =>
                  void run('notify', async () => {
                    await setCityNotify(accountId, unitId, !notify);
                  })
                }
                className={`relative h-7 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
                  notify ? 'bg-lake-blue' : 'bg-black/[0.12]'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                    notify ? 'left-[1.2rem]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {kinds.has('live_here') && !home ? (
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() =>
                  void run('home', async () => {
                    let live: AccountPlace | undefined = rows.find(
                      (row) => row.kind === 'live_here',
                    );
                    if (!live) {
                      live = await ensureCityKind(
                        accountId,
                        unitId,
                        'live_here' satisfies AccountPlaceKind,
                        unitName,
                      );
                    }
                    await electHome(accountId, live.id);
                  })
                }
                className="text-[13px] font-semibold text-lake-blue transition active:opacity-70 disabled:opacity-40"
              >
                Make Home
              </button>
            ) : null}
            {home?.home_locked_until ? (
              <p className="text-[12px] text-foreground-muted">
                {homeLocked
                  ? homeLockLabel(home.home_locked_until)
                  : `Can change home after ${homeLockDate(home.home_locked_until) ?? 'soon'}`}
              </p>
            ) : null}
            {hasAny ? (
              <button
                type="button"
                disabled={Boolean(busyKey) || homeLocked}
                onClick={() =>
                  void run('remove', async () => {
                    await removeCity(accountId, unitId);
                  })
                }
                className="ml-auto text-[13px] font-semibold text-foreground-muted transition active:text-red-700 disabled:opacity-40"
              >
                Remove
              </button>
            ) : null}
          </div>
        </>
      )}

      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}

      {accountId ? (
        <Link
          href={DISCOVER_PLACES_PATH}
          className="inline-flex text-[12px] font-semibold text-foreground-muted transition active:text-foreground"
        >
          Manage all places →
        </Link>
      ) : null}
    </section>
  );
}
