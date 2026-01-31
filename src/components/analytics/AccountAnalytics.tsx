'use client';

import { MapPinIcon, EyeIcon } from '@heroicons/react/24/outline';
import { isCardVisible, type AnalyticsCardId } from '@/lib/analytics/cardVisibility';

interface AccountAnalyticsProps {
  liveMentions: number;
  profileViews: number;
  totalPinViews: number;
  totalMentionViews: number;
  loading?: boolean;
  isAdmin?: boolean;
}

export default function AccountAnalytics({
  liveMentions,
  profileViews,
  totalPinViews,
  totalMentionViews,
  loading = false,
  isAdmin = false,
}: AccountAnalyticsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-md border border-white/10 bg-white/5 p-2 flex flex-col items-center justify-center gap-0.5 min-h-[56px] animate-pulse">
            <div className="w-4 h-4 bg-gray-400/20 rounded" />
            <div className="w-8 h-4 bg-gray-400/20 rounded" />
            <div className="w-12 h-2 bg-gray-400/20 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      id: 'liveMentions' as AnalyticsCardId,
      label: 'Live Mentions',
      value: liveMentions,
      icon: MapPinIcon,
    },
    {
      id: 'profileViews' as AnalyticsCardId,
      label: 'Profile Views',
      value: profileViews,
      icon: EyeIcon,
    },
    {
      id: 'totalPinViews' as AnalyticsCardId,
      label: 'Pin Views',
      value: totalPinViews,
      icon: MapPinIcon,
    },
    {
      id: 'totalMentionViews' as AnalyticsCardId,
      label: 'Mention Views',
      value: totalMentionViews,
      icon: EyeIcon,
    },
  ];

  const visibleCards = cards.filter((card) => isCardVisible(card.id, isAdmin));

  if (visibleCards.length === 0) {
    return null;
  }

  // Adjust grid columns based on number of visible cards
  const gridCols = visibleCards.length === 1 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <div className={`grid ${gridCols} gap-2`}>
      {visibleCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="rounded-md border border-white/10 bg-white/5 p-2 flex flex-col items-center justify-center gap-0.5 min-h-[56px]"
          >
            <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-white tabular-nums">{card.value.toLocaleString()}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">{card.label}</span>
          </div>
        );
      })}
    </div>
  );
}
