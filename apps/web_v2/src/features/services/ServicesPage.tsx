'use client';

/**
 * /services — home-service bid-request portal.
 * Apple-style flow: one job per mode, inset groups, pickers for choice lists.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { TopBar } from '@/features/appShell/TopBar';
import { useAuthSafe } from '@/features/auth';
import { POST_CAPTION_MAX } from '@/features/community/postCaptionLimits';
import { formatRelativeTime } from '@/features/community/pinPostApi';
import {
  createServiceRequest,
  fetchMyServiceRequests,
  type ServiceRequestRow,
  type ServiceRequestSite,
} from '@/features/services/serviceRequestApi';
import {
  SERVICE_CATEGORIES,
  formatServiceSelectionSummary,
  serviceCategoryById,
  tradesForCategory,
  type ServiceCategoryId,
} from '@/features/services/serviceTrades';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconHome,
  IconMapPin,
  IconPlus,
  IconSpinner,
  IconX,
} from '@/features/map/dockCore/core/icons';
import {
  listAccountPlaces,
  type AccountPlace,
} from '@/lib/accountPlaces/api';
import { placeDisplayName } from '@/lib/accountPlaces/types';
import {
  SERVICE_URGENCIES,
  SERVICE_URGENCY_LABEL,
  type ServiceUrgency,
} from '@/lib/community/composeKindMeta';
import { haptic } from '@/lib/despia/haptics';
import { safePadBottom, safePadTop } from '@/lib/despia/safeArea';
import {
  fetchForwardGeocode,
  FORWARD_GEOCODE_MIN_QUERY,
  type ForwardGeocodeHit,
} from '@/lib/geo/fetch/fetchForwardGeocode';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';
import { postPath } from '@/lib/routes/routePolicy';

type Mode = 'list' | 'compose';

const GROUP = 'overflow-hidden rounded-[10px] bg-white';
const DIVIDER = 'divide-y divide-black/[0.06]';
const FOOTNOTE =
  'px-4 pt-2 text-[13px] leading-snug text-[#8E8E93]';
const SECTION =
  'px-4 pb-1.5 pt-6 text-[13px] font-normal uppercase tracking-[0.02em] text-[#8E8E93]';

function shortAddress(address: string): string {
  const first = address.split(',')[0]?.trim();
  return first || address;
}

function siteFromPlace(place: AccountPlace): ServiceRequestSite | null {
  if (
    typeof place.lat !== 'number' ||
    typeof place.lng !== 'number' ||
    !Number.isFinite(place.lat) ||
    !Number.isFinite(place.lng)
  ) {
    return null;
  }
  const address =
    place.address_line?.trim() ||
    place.unit_name?.trim() ||
    placeDisplayName(place);
  if (!address) return null;
  return { lat: place.lat, lng: place.lng, address };
}

function NavRow({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.toggle();
        onPress();
      }}
      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-black/[0.04]"
    >
      <span className="w-[5.75rem] shrink-0 text-[17px] text-[#1C1C1E]">
        {label}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-right text-[17px] ${
          value ? 'text-[#3C3C43]' : 'text-[#C7C7CC]'
        }`}
      >
        {value || placeholder}
      </span>
      <IconChevronRight className="h-4 w-4 shrink-0 text-[#C7C7CC]" />
    </button>
  );
}

function PickerSheet({
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

function ServicePicker({
  open,
  categoryId,
  tradeIds,
  onChange,
  onClose,
}: {
  open: boolean;
  categoryId: ServiceCategoryId | null;
  tradeIds: string[];
  onChange: (next: { categoryId: ServiceCategoryId; tradeIds: string[] }) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'category' | 'trades'>('category');
  const [draftCategory, setDraftCategory] = useState<ServiceCategoryId | null>(
    categoryId,
  );
  const [draftTrades, setDraftTrades] = useState<string[]>(tradeIds);

  useEffect(() => {
    if (!open) return;
    setDraftCategory(categoryId);
    setDraftTrades(tradeIds);
    setStep(categoryId && tradeIds.length > 0 ? 'trades' : 'category');
  }, [open, categoryId, tradeIds]);

  const categoryTrades = draftCategory
    ? tradesForCategory(draftCategory)
    : [];
  const draftCategoryLabel =
    serviceCategoryById(draftCategory)?.label ?? 'Services';

  const toggleTrade = (id: string) => {
    haptic.toggle();
    setDraftTrades((prev) =>
      prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id],
    );
  };

  const canDone = Boolean(draftCategory) && draftTrades.length > 0;

  return (
    <PickerSheet
      open={open}
      title={step === 'category' ? 'Category' : draftCategoryLabel}
      onClose={onClose}
      leading={
        step === 'trades' ? (
          <button
            type="button"
            onClick={() => {
              haptic.toggle();
              setStep('category');
            }}
            aria-label="Back to categories"
            className="relative z-[1] inline-flex h-9 w-9 items-center justify-center rounded-full text-lake-blue active:opacity-60"
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
        ) : undefined
      }
      trailing={
        step === 'trades' ? (
          <button
            type="button"
            disabled={!canDone}
            onClick={() => {
              if (!draftCategory || !canDone) return;
              haptic.toggle();
              onChange({ categoryId: draftCategory, tradeIds: draftTrades });
              onClose();
            }}
            className="px-1 py-1.5 text-[16px] font-semibold text-lake-blue transition enabled:active:opacity-70 disabled:opacity-35"
          >
            Done
          </button>
        ) : null
      }
    >
      {step === 'category' ? (
        <>
          <p className="mb-3 px-1 text-[13px] leading-snug text-[#8E8E93]">
            What kind of work is this?
          </p>
          <ul className={`${GROUP} ${DIVIDER}`}>
            {SERVICE_CATEGORIES.map((row) => {
              const on = draftCategory === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      haptic.toggle();
                      setDraftCategory(row.id);
                      setDraftTrades((prev) => {
                        const allowed = new Set(
                          tradesForCategory(row.id).map((trade) => trade.id),
                        );
                        const kept = prev.filter((id) => allowed.has(id));
                        return kept;
                      });
                      setStep('trades');
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.04]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] text-[#1C1C1E]">{row.label}</p>
                      <p className="mt-0.5 text-[13px] text-[#8E8E93]">
                        {row.hint}
                      </p>
                    </div>
                    {on ? (
                      <IconCheck className="h-5 w-5 shrink-0 text-lake-blue" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 shrink-0 text-[#C7C7CC]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <p className="mb-3 px-1 text-[13px] leading-snug text-[#8E8E93]">
            Select every trade this job needs.
          </p>
          <ul className={`${GROUP} ${DIVIDER}`}>
            {categoryTrades.map((row) => {
              const on = draftTrades.includes(row.id);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => toggleTrade(row.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.04]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] text-[#1C1C1E]">{row.label}</p>
                      <p className="mt-0.5 text-[13px] text-[#8E8E93]">
                        {row.hint}
                      </p>
                    </div>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        on
                          ? 'border-lake-blue bg-lake-blue text-white'
                          : 'border-[#C7C7CC] bg-transparent text-transparent'
                      }`}
                      aria-hidden
                    >
                      <IconCheck className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </PickerSheet>
  );
}

function LocationPicker({
  open,
  site,
  places,
  onChange,
  onClose,
}: {
  open: boolean;
  site: ServiceRequestSite | null;
  places: { place: AccountPlace; site: ServiceRequestSite }[];
  onChange: (next: ServiceRequestSite) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ForwardGeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < FORWARD_GEOCODE_MIN_QUERY) {
      setHits([]);
      return;
    }
    const ac = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(() => {
      void fetchForwardGeocode(q, ac.signal)
        .then((next) => {
          if (!ac.signal.aborted) setHits(next);
        })
        .catch(() => {
          if (!ac.signal.aborted) setHits([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setSearching(false);
        });
    }, 280);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [open, query]);

  const pick = (next: ServiceRequestSite) => {
    haptic.toggle();
    onChange(next);
    onClose();
  };

  return (
    <PickerSheet open={open} title="Location" onClose={onClose}>
      <div className={`${GROUP} mb-5`}>
        <div className="flex min-h-[44px] items-center gap-3 px-4">
          <IconMapPin className="h-5 w-5 shrink-0 text-[#8E8E93]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address"
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent text-[17px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:ring-0"
            autoComplete="street-address"
          />
          {searching ? (
            <IconSpinner className="h-4 w-4 shrink-0 text-[#8E8E93]" />
          ) : null}
        </div>
      </div>

      {hits.length > 0 ? (
        <>
          <p className={SECTION.replace('pt-6', 'pt-0')}>Results</p>
          <ul className={`${GROUP} ${DIVIDER} mb-5`}>
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() =>
                    pick({ lat: hit.lat, lng: hit.lng, address: hit.name })
                  }
                  className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-black/[0.04]"
                >
                  <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#8E8E93]" />
                  <span className="min-w-0 flex-1 text-[15px] leading-snug text-[#1C1C1E]">
                    {hit.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {places.length > 0 ? (
        <>
          <p className={SECTION.replace('pt-6', hits.length ? 'pt-2' : 'pt-0')}>
            Saved
          </p>
          <ul className={`${GROUP} ${DIVIDER}`}>
            {places.map(({ place, site: placeSite }) => {
              const on =
                site?.lat === placeSite.lat &&
                site?.lng === placeSite.lng &&
                site?.address === placeSite.address;
              const label = place.is_home
                ? `Home · ${shortAddress(placeSite.address)}`
                : shortAddress(placeSite.address);
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => pick(placeSite)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.04]"
                  >
                    <IconHome className="h-5 w-5 shrink-0 text-[#8E8E93]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[17px] text-[#1C1C1E]">
                        {label}
                      </p>
                      {placeSite.address !== shortAddress(placeSite.address) ? (
                        <p className="mt-0.5 truncate text-[13px] text-[#8E8E93]">
                          {placeSite.address}
                        </p>
                      ) : null}
                    </div>
                    {on ? (
                      <IconCheck className="h-5 w-5 shrink-0 text-lake-blue" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {places.length === 0 && hits.length === 0 && query.trim().length < 2 ? (
        <p className="px-1 pt-2 text-[15px] leading-snug text-[#8E8E93]">
          Search a Minnesota address, or save a home place to reuse it here.
        </p>
      ) : null}
    </PickerSheet>
  );
}

export default function ServicesPage() {
  const router = useRouter();
  const { account } = useAuthSafe();

  const [mode, setMode] = useState<Mode>('list');
  const [categoryId, setCategoryId] = useState<ServiceCategoryId | null>(null);
  const [tradeIds, setTradeIds] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<ServiceUrgency>('flexible');
  const [body, setBody] = useState('');
  const [budget, setBudget] = useState('');
  const [site, setSite] = useState<ServiceRequestSite | null>(null);
  const [homePlaces, setHomePlaces] = useState<AccountPlace[]>([]);
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homeSeeded, setHomeSeeded] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const serviceSummary = formatServiceSelectionSummary(categoryId, tradeIds);

  const openCompose = useCallback(() => {
    haptic.toggle();
    setError(null);
    setMode('compose');
  }, []);

  const closeCompose = useCallback(() => {
    haptic.toggle();
    setError(null);
    setMode('list');
  }, []);

  const addressablePlaces = useMemo(() => {
    return homePlaces
      .map((place) => ({ place, site: siteFromPlace(place) }))
      .filter((row): row is { place: AccountPlace; site: ServiceRequestSite } =>
        Boolean(row.site),
      )
      .slice(0, 6);
  }, [homePlaces]);

  const locationSummary = site
    ? site.address.includes(',')
      ? shortAddress(site.address)
      : site.address
    : null;

  const loadRequests = useCallback(async (signal?: AbortSignal) => {
    setLoadingRequests(true);
    try {
      const rows = await fetchMyServiceRequests(signal);
      if (!signal?.aborted) setRequests(rows);
    } catch {
      if (!signal?.aborted) setRequests([]);
    } finally {
      if (!signal?.aborted) setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (!account?.id) {
      setHomePlaces([]);
      setHomeSeeded(false);
      return;
    }
    let cancelled = false;
    void listAccountPlaces(account.id)
      .then((rows) => {
        if (cancelled) return;
        const preferred = rows.filter(
          (row) => row.is_home || row.kind === 'live_here' || row.address_line,
        );
        setHomePlaces(preferred.length > 0 ? preferred : rows);
        if (homeSeeded) return;
        const home = preferred.find((row) => row.is_home) ?? preferred[0];
        if (!home) return;
        const next = siteFromPlace(home);
        if (!next) return;
        setSite(next);
        setHomeSeeded(true);
      })
      .catch(() => {
        if (!cancelled) setHomePlaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [account?.id, homeSeeded]);

  useEffect(() => {
    const ac = new AbortController();
    void loadRequests(ac.signal);
    return () => ac.abort();
  }, [loadRequests]);

  const canSubmit =
    Boolean(account) &&
    body.trim().length > 0 &&
    Boolean(categoryId) &&
    tradeIds.length > 0 &&
    Boolean(site) &&
    !submitting;

  const onSubmit = async () => {
    if (!canSubmit || !site || !categoryId) return;
    setSubmitting(true);
    setError(null);
    haptic.findMe.success();
    try {
      const { id } = await createServiceRequest({
        categoryId,
        tradeIds,
        urgency,
        body,
        budget: budget.trim() || null,
        site,
      });
      setBody('');
      setBudget('');
      await loadRequests();
      setMode('list');
      haptic.toggle();
      router.push(postPath(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post your request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageScroll onRefresh={mode === 'list' ? () => loadRequests() : undefined}>
      <TopBar
        title={mode === 'compose' ? 'New Request' : 'Services'}
        trailing={
          mode === 'compose' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeCompose}
                className="px-1 py-1.5 text-[16px] font-semibold text-[#8E8E93] transition active:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void onSubmit()}
                className="px-1 py-1.5 text-[16px] font-semibold text-lake-blue transition enabled:active:opacity-70 disabled:opacity-35"
              >
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          ) : account ? (
            <button
              type="button"
              onClick={openCompose}
              aria-label="New request"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lake-blue transition active:bg-black/[0.05]"
            >
              <IconPlus className="h-5 w-5" />
            </button>
          ) : null
        }
      />

      {mode === 'compose' ? (
        <div className="px-4 pb-10 pt-1">
          <p className={SECTION.replace('pt-6', 'pt-3')}>Details</p>
          <div className={GROUP}>
            <textarea
              value={body}
              onChange={(e) =>
                setBody(e.target.value.slice(0, POST_CAPTION_MAX))
              }
              maxLength={POST_CAPTION_MAX}
              rows={5}
              placeholder="Describe the work…"
              className="w-full resize-none border-0 bg-transparent px-4 pb-2 pt-3 text-[17px] leading-[1.35] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:ring-0"
            />
            <p className="px-4 pb-3 text-right text-[12px] tabular-nums text-[#8E8E93]">
              {body.trim().length} / {POST_CAPTION_MAX}
            </p>
          </div>

          <p className={SECTION}>Request</p>
          <div className={`${GROUP} ${DIVIDER}`}>
            <NavRow
              label="Service"
              value={serviceSummary}
              placeholder="Choose"
              onPress={() => setServiceOpen(true)}
            />
            <NavRow
              label="Location"
              value={locationSummary}
              placeholder="Required"
              onPress={() => setLocationOpen(true)}
            />
          </div>

          <p className={SECTION}>Options</p>
          <div className={`${GROUP} ${DIVIDER}`}>
            <div className="px-4 py-3">
              <p className="mb-2 text-[13px] text-[#8E8E93]">Timing</p>
              <div
                className="flex rounded-[8px] bg-black/[0.06] p-[2px]"
                role="tablist"
                aria-label="Timing"
              >
                {SERVICE_URGENCIES.map((id) => {
                  const on = urgency === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => {
                        haptic.toggle();
                        setUrgency(id);
                      }}
                      className={`min-h-[32px] flex-1 rounded-[6px] px-1 text-[13px] font-semibold transition active:opacity-80 ${
                        on
                          ? 'bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                          : 'text-[#8E8E93]'
                      }`}
                    >
                      {SERVICE_URGENCY_LABEL[id]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex min-h-[44px] items-center gap-3 px-4 py-2">
              <span className="w-[5.75rem] shrink-0 text-[17px] text-[#1C1C1E]">
                Budget
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value.slice(0, 40))}
                placeholder="Optional"
                className="min-w-0 flex-1 border-0 bg-transparent text-right text-[17px] text-[#3C3C43] outline-none placeholder:text-[#C7C7CC] focus:ring-0"
              />
            </div>
          </div>

          <p className={FOOTNOTE}>
            Posted to neighbors nearby. Replies come in as bids on your request.
          </p>

          {error ? (
            <p className="mt-3 px-1 text-[14px] font-medium text-[#C62828]">
              {error}
            </p>
          ) : null}

          {!account ? (
            <p className="mt-4 text-center text-[13px] text-[#8E8E93]">
              Sign in to post a request.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="px-4 pb-10 pt-3">
          {loadingRequests ? (
            <div className="flex justify-center py-16">
              <IconSpinner className="h-5 w-5 text-[#8E8E93]" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <p className="text-[17px] font-semibold text-[#1C1C1E]">
                No Requests
              </p>
              <p className="mt-2 max-w-[16rem] text-[15px] leading-snug text-[#8E8E93]">
                Post what you need at an address. Locals can bid.
              </p>
              {account ? (
                <button
                  type="button"
                  onClick={openCompose}
                  aria-label="New request"
                  className="mt-8 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#1C1C1E] text-white transition active:opacity-80"
                >
                  <IconPlus className="h-7 w-7" />
                </button>
              ) : (
                <p className="mt-6 text-[13px] text-[#8E8E93]">
                  Sign in to post a request.
                </p>
              )}
            </div>
          ) : (
            <ul className={`${GROUP} ${DIVIDER}`}>
              {requests.map((row) => (
                <li key={row.id}>
                  <Link
                    href={postPath(row.id)}
                    className="flex items-center gap-2 px-4 py-3 active:bg-black/[0.04]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[17px] font-semibold text-[#1C1C1E]">
                          {row.category_label
                            ? `${row.category_label} · ${row.trade_label || row.trade || 'Service'}`
                            : row.trade_label || row.trade || 'Service'}
                        </p>
                        <span className="shrink-0 text-[13px] text-[#8E8E93]">
                          {formatRelativeTime(row.created_at)}
                        </span>
                      </div>
                      {row.body ? (
                        <p className="mt-0.5 line-clamp-1 text-[15px] text-[#3C3C43]">
                          {row.body}
                        </p>
                      ) : null}
                      <p className="mt-1 truncate text-[13px] text-[#8E8E93]">
                        {[
                          row.full_address
                            ? shortAddress(row.full_address)
                            : null,
                          row.urgency
                            ? SERVICE_URGENCY_LABEL[row.urgency]
                            : null,
                          row.comment_count > 0
                            ? `${row.comment_count} bid${row.comment_count === 1 ? '' : 's'}`
                            : 'Awaiting bids',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <IconChevronRight className="h-4 w-4 shrink-0 text-[#C7C7CC]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ServicePicker
        open={serviceOpen}
        categoryId={categoryId}
        tradeIds={tradeIds}
        onChange={({ categoryId: nextCategory, tradeIds: nextTrades }) => {
          setCategoryId(nextCategory);
          setTradeIds(nextTrades);
        }}
        onClose={() => setServiceOpen(false)}
      />
      <LocationPicker
        open={locationOpen}
        site={site}
        places={addressablePlaces}
        onChange={setSite}
        onClose={() => setLocationOpen(false)}
      />
    </PageScroll>
  );
}
