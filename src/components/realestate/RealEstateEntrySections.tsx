'use client';

import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  HomeIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const sectionClass =
  'p-[10px] rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors space-y-1.5 block';
const iconClass = 'w-4 h-4 text-gray-500 dark:text-foreground-muted';
const labelClass = 'text-xs font-medium text-gray-900 dark:text-foreground';
const descClass = 'text-[11px] text-gray-500 dark:text-foreground-muted leading-relaxed';

/** Entry point: Explore the Market. Wire to /realestate/explore or market tools. */
export function RealEstateExploreMarketSection() {
  return (
    <Link
      href="/realestate/explore"
      data-section="realestate-explore-market"
      aria-label="Explore the Market"
      className={sectionClass}
    >
      <div className="flex items-center gap-2">
        <MagnifyingGlassIcon className={iconClass} aria-hidden />
        <span className={labelClass}>Explore the Market</span>
      </div>
      <p className={descClass}>Market trends, areas, and data. Research before you commit.</p>
    </Link>
  );
}

/** Entry point: Buy. Wire to /realestate/buy or buyer flows. */
export function RealEstateBuySection() {
  return (
    <Link
      href="/realestate/buy"
      data-section="realestate-buy"
      aria-label="Buy"
      className={sectionClass}
    >
      <div className="flex items-center gap-2">
        <HomeIcon className={iconClass} aria-hidden />
        <span className={labelClass}>Buy</span>
      </div>
      <p className={descClass}>Find properties, tours, and purchase support.</p>
    </Link>
  );
}

/** Entry point: Sell. Wire to /realestate/sell or seller flows. */
export function RealEstateSellSection() {
  return (
    <Link
      href="/realestate/sell"
      data-section="realestate-sell"
      aria-label="Sell"
      className={sectionClass}
    >
      <div className="flex items-center gap-2">
        <ArrowTrendingUpIcon className={iconClass} aria-hidden />
        <span className={labelClass}>Sell</span>
      </div>
      <p className={descClass}>List, price, and close. Seller tools and resources.</p>
    </Link>
  );
}

/** Entry point: Connect. Wire to /realestate/connect or professional network. */
export function RealEstateConnectSection() {
  return (
    <Link
      href="/realestate/connect"
      data-section="realestate-connect"
      aria-label="Connect"
      className={sectionClass}
    >
      <div className="flex items-center gap-2">
        <UserGroupIcon className={iconClass} aria-hidden />
        <span className={labelClass}>Connect</span>
      </div>
      <p className={descClass}>Agents, lenders, and partners. Build your team.</p>
    </Link>
  );
}

export function RealEstateEntrySections() {
  return (
    <>
      <RealEstateExploreMarketSection />
      <RealEstateBuySection />
      <RealEstateSellSection />
      <RealEstateConnectSection />
    </>
  );
}
