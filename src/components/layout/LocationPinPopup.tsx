'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  XMarkIcon,
  MapPinIcon,
  CheckIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';

type MentionType = { id: string; emoji: string; name: string };

interface LocationPinPopupProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  address: string | null;
  mapMeta?: Record<string, unknown> | null;
  accountId: string | null;
  collections?: Collection[];
  onPinCreated?: (pin: ProfilePin) => void;
}

/** Extract display info from mapMeta (boundary or feature). */
function getMapMetaDisplay(mapMeta: Record<string, unknown> | null | undefined): { emoji: string; name: string } | null {
  if (!mapMeta) return null;
  // Boundary click (state / county / CTU)
  const boundaryLayer = mapMeta.boundaryLayer as string | undefined;
  const boundaryName = mapMeta.boundaryName as string | undefined;
  if (boundaryLayer && boundaryName) {
    const layerLabel =
      boundaryLayer === 'state'
        ? 'State boundary'
        : boundaryLayer === 'district'
          ? 'Congressional district'
          : boundaryLayer === 'county'
            ? 'County'
            : boundaryLayer === 'ctu'
              ? 'CTU'
              : 'Boundary';
    return { emoji: '\u{1F5FA}\uFE0F', name: `${layerLabel}: ${boundaryName}` };
  }
  // Pin / location feature
  const f = mapMeta.feature as Record<string, unknown> | undefined;
  if (!f) return null;
  const name = ((f.name ?? f.label ?? '') as string) || null;
  if (!name && !f.icon) return null;
  const emoji = typeof f.icon === 'string' ? f.icon : '\u{1F4CD}';
  return { emoji, name: name || 'Location' };
}

/**
 * Single-step bottom card for marking a location on the map.
 * Authenticated: address + map meta + inline tag pills + "Mark Location".
 * Unauthenticated: address + "Sign in to add pin".
 * After creation, the caller opens FinishPinModal for description/media/collection.
 */
export default function LocationPinPopup({
  isOpen,
  onClose,
  lat,
  lng,
  address,
  mapMeta,
  accountId,
  onPinCreated,
}: LocationPinPopupProps) {
  const { activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [selectedMentionTypeId, setSelectedMentionTypeId] = useState<string | null>(null);
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState('');
  const [showAllTags, setShowAllTags] = useState(false);

  const isAuthenticated = Boolean(accountId || activeAccountId);

  const filteredMentionTypes = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return mentionTypes;
    return mentionTypes.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.emoji && t.emoji.toLowerCase().includes(q))
    );
  }, [mentionTypes, tagSearch]);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setSelectedMentionTypeId(null);
    setTagSearch('');
    setShowAllTags(false);
    setError(null);
  }, [isOpen]);

  // Fetch mention types
  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('mention_types')
      .select('id, emoji, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setMentionTypes((data ?? []) as MentionType[]));
  }, [isOpen]);

  const handleSignIn = useCallback(() => {
    openWelcome();
  }, [openWelcome]);

  const handleMarkLocation = useCallback(async () => {
    if (!accountId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          lat,
          lng,
          description: null,
          mention_type_id: selectedMentionTypeId,
          collection_id: null,
          image_url: null,
          media_type: 'none',
          visibility: 'public',
          full_address: address ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create pin');
      }

      const { pin } = await res.json();
      onPinCreated?.(pin);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pin');
    } finally {
      setIsSubmitting(false);
    }
  }, [accountId, lat, lng, selectedMentionTypeId, address, onPinCreated, onClose]);

  if (!isOpen) return null;

  const displayAddress = address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const mapMetaInfo = getMapMetaDisplay(mapMeta);

  // Inline collapsed row: show first 8 tags
  const COLLAPSED_TAG_COUNT = 8;
  const hasMoreTags = mentionTypes.length > COLLAPSED_TAG_COUNT;
  const visibleTags = showAllTags ? filteredMentionTypes : mentionTypes.slice(0, COLLAPSED_TAG_COUNT);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2100] flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-[500px] mx-2 mb-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface shadow-sm overflow-hidden flex flex-col"
        role="dialog"
        aria-label="Mark location"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-white/10 flex-shrink-0">
          <div />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-foreground">
            Mark location
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 -mr-1 text-gray-500 hover:text-gray-700 dark:text-foreground-muted dark:hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 space-y-3">
          {/* Address */}
          <div className="flex items-start gap-2">
            <MapPinIcon className="w-4 h-4 text-gray-500 dark:text-foreground-muted flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-gray-900 dark:text-foreground break-words">{displayAddress}</p>
              <p className="text-[10px] text-gray-500 dark:text-foreground-muted mt-0.5">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            </div>
          </div>

          {isAuthenticated ? (
            <>
              {/* Map meta — above tag label */}
              {mapMetaInfo && (
                <div className="flex items-center gap-1.5">
                  <span className="text-base flex-shrink-0" aria-hidden>
                    {mapMetaInfo.emoji}
                  </span>
                  <span className="text-xs font-medium text-gray-900 dark:text-foreground truncate">
                    {mapMetaInfo.name}
                  </span>
                </div>
              )}

              {/* Tag selector */}
              <div className="space-y-2">
                <label className="block text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wide">
                  Tag
                </label>

                {/* Collapsed: horizontal scroll row */}
                {!showAllTags ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 overflow-x-auto scrollbar-hide">
                      <div className="flex gap-1.5 w-max">
                        {mentionTypes.length === 0 ? (
                          <span className="text-xs text-gray-500 dark:text-foreground-muted py-1">Loading…</span>
                        ) : (
                          visibleTags.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() =>
                                setSelectedMentionTypeId(
                                  selectedMentionTypeId === t.id ? null : t.id
                                )
                              }
                              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border whitespace-nowrap transition-colors ${
                                selectedMentionTypeId === t.id
                                  ? 'border-lake-blue bg-lake-blue/15 text-lake-blue dark:bg-lake-blue/20 dark:border-lake-blue/50'
                                  : 'border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-white/5'
                              }`}
                            >
                              <span className="text-sm">{t.emoji}</span>
                              <span>{t.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    {hasMoreTags && (
                      <button
                        type="button"
                        onClick={() => setShowAllTags(true)}
                        className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-gray-700 dark:text-foreground-muted dark:hover:text-foreground transition-colors"
                      >
                        All
                        <ChevronDownIcon className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  /* Expanded: search + wrapped grid */
                  <>
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-foreground-muted" />
                      <input
                        type="text"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search tags…"
                        autoFocus
                        className="w-full h-8 pl-8 pr-2 text-xs border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface text-gray-900 dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
                        aria-label="Search tags"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto p-1 scrollbar-hide">
                      {filteredMentionTypes.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-gray-500 dark:text-foreground-muted text-center">
                          No tags match
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {filteredMentionTypes.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() =>
                                setSelectedMentionTypeId(
                                  selectedMentionTypeId === t.id ? null : t.id
                                )
                              }
                              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                                selectedMentionTypeId === t.id
                                  ? 'border-lake-blue bg-lake-blue/15 text-lake-blue dark:bg-lake-blue/20 dark:border-lake-blue/50'
                                  : 'border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-white/5'
                              }`}
                            >
                              <span className="text-sm">{t.emoji}</span>
                              <span>{t.name}</span>
                              {selectedMentionTypeId === t.id && (
                                <CheckIcon className="w-3 h-3 text-lake-blue" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAllTags(false);
                        setTagSearch('');
                      }}
                      className="text-[10px] text-gray-500 hover:text-gray-700 dark:text-foreground-muted dark:hover:text-foreground transition-colors"
                    >
                      Show less
                    </button>
                  </>
                )}
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </>
          ) : null}
        </div>

        {/* Action */}
        <div className="p-3 border-t border-gray-200 dark:border-white/10 flex-shrink-0">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleMarkLocation}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-md text-white bg-lake-blue hover:bg-lake-blue/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              {isSubmitting ? (
                'Marking…'
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Mark Location
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-md text-white bg-lake-blue hover:bg-lake-blue/90 transition-colors"
            >
              Sign in to add pin
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
