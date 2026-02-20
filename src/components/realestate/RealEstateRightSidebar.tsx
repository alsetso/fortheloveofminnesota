'use client';

import { useState } from 'react';
import {
  MapIcon,
  FunnelIcon,
  HeartIcon,
  EllipsisHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const MOCK_PROPERTIES = [
  { id: '1', price: 199999, beds: 3, baths: 2, sqft: 785, address: '2800 Adams Ave', city: 'Minneapolis', state: 'MN', zip: '55418', type: 'House', brokerage: 'BH&G Real Estate', openHouse: 'Sun 12–2pm (2/22)', imagePlaceholder: true },
  { id: '2', price: 324500, beds: 4, baths: 2, sqft: 1240, address: '4512 Grand Ave', city: 'Saint Paul', state: 'MN', zip: '55102', type: 'House', brokerage: 'Edina Realty', openHouse: null, imagePlaceholder: true },
  { id: '3', price: 189900, beds: 2, baths: 1, sqft: 620, address: '892 Oak St', city: 'Minneapolis', state: 'MN', zip: '55408', type: 'House', brokerage: 'Coldwell Banker', openHouse: 'Sat 1–4pm', imagePlaceholder: true },
];

const MAP_STYLES = [
  { value: 'street', label: 'Street' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'light', label: 'Light' },
] as const;

export default function RealEstateRightSidebar() {
  const [mapStyle, setMapStyle] = useState<string>('street');
  const [bedsMin, setBedsMin] = useState<string>('');
  const [bathsMin, setBathsMin] = useState<string>('');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [page, setPage] = useState(1);
  const totalPages = 3; // pagination-ready

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Map settings */}
      <section className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <MapIcon className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="text-xs font-semibold text-gray-900 dark:text-foreground">Map</h3>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider block">
            Style
          </label>
          <select
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {MAP_STYLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Filters */}
      <section className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <FunnelIcon className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="text-xs font-semibold text-gray-900 dark:text-foreground">Filters</h3>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Beds</label>
              <input
                type="text"
                placeholder="Min"
                value={bedsMin}
                onChange={(e) => setBedsMin(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Baths</label>
              <input
                type="text"
                placeholder="Min"
                value={bathsMin}
                onChange={(e) => setBathsMin(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Price</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Min"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface"
              />
              <input
                type="text"
                placeholder="Max"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Property records */}
      <section className="flex-1 min-h-0 flex flex-col p-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-foreground mb-2">Properties</h3>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-2">
          {MOCK_PROPERTIES.map((p) => (
            <article
              key={p.id}
              className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface overflow-hidden hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
            >
              {/* Image area */}
              <div className="relative aspect-[4/3] bg-gray-100 dark:bg-white/5">
                {p.openHouse && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-900 text-white">
                    Open: {p.openHouse}
                  </span>
                )}
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white/80 dark:bg-black/30 text-gray-600 hover:text-gray-900"
                  aria-label="Save"
                >
                  <HeartIcon className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {[1, 2, 3, 4, 5].slice(0, 5).map((i) => (
                    <span
                      key={i}
                      className={`w-1 h-1 rounded-full ${i === 1 ? 'bg-gray-700' : 'bg-white/60'}`}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
              {/* Details */}
              <div className="p-[10px] space-y-1">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-foreground">
                    ${p.price.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className="p-0.5 text-gray-500 hover:text-gray-700"
                    aria-label="More options"
                  >
                    <EllipsisHorizontalIcon className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-600 dark:text-foreground-muted">
                  {p.beds} bds | {p.baths} ba | {p.sqft.toLocaleString()} sqft · {p.type}
                </p>
                <p className="text-xs text-gray-600 dark:text-foreground-muted">
                  {p.address}, {p.city}, {p.state} {p.zip}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-foreground-muted uppercase tracking-wider pt-0.5">
                  {p.brokerage}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* Pagination-ready */}
        <div className="flex-shrink-0 flex items-center justify-between gap-2 pt-3 mt-2 border-t border-gray-200 dark:border-white/10">
          <span className="text-[10px] text-gray-500 dark:text-foreground-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="p-1.5 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-1.5 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
              aria-label="Next page"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
