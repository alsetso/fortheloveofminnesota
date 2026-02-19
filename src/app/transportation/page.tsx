'use client';

import { useState } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import TransportSubNav from '@/components/sub-nav/TransportSubNav';
import Link from 'next/link';
import {
  TruckIcon,
  SignalIcon,
  PaperAirplaneIcon,
  MapIcon,
  ArrowsRightLeftIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline';

const SECTIONS = [
  {
    label: 'NexTrip',
    description: 'Real-time Metro Transit agencies, routes & departures',
    href: '/transportation/nextrip',
    icon: TruckIcon,
  },
  {
    label: 'Trip Planner',
    description: 'Plan transit trips across the Twin Cities metro',
    href: '/transportation/trip-planner',
    icon: ArrowsRightLeftIcon,
  },
  {
    label: 'GTFS Live Map',
    description: 'Real-time vehicle positions on a live map',
    href: '/transportation/gtfs',
    icon: SignalSlashIcon,
  },
  {
    label: 'Flight Tracker',
    description: 'Live flight tracking for Minnesota airports',
    href: '/transportation/flights',
    icon: PaperAirplaneIcon,
  },
  {
    label: 'MnDOT Traffic',
    description: 'Road conditions, construction & traffic cameras',
    href: '/transportation/mndot',
    icon: SignalIcon,
    disabled: true,
  },
  {
    label: 'Airports',
    description: 'MSP and regional airport information',
    href: '/transportation/airports',
    icon: PaperAirplaneIcon,
    disabled: true,
  },
  {
    label: 'Bike & Trail',
    description: 'Cycling infrastructure & trail maps',
    href: '/transportation/bike-trail',
    icon: MapIcon,
    disabled: true,
  },
];

export default function TransportationPage() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);

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
        <div className="space-y-1">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-foreground">Transportation</h1>
          <p className="text-xs text-gray-500 dark:text-foreground-muted">Minnesota transit, roads & travel data</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;

            if (s.disabled) {
              return (
                <div
                  key={s.href}
                  className="p-[10px] rounded-md border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-surface/50 space-y-1.5 cursor-default select-none"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-gray-300 dark:text-foreground-muted/30" />
                    <span className="text-xs font-medium text-gray-400 dark:text-foreground-muted/40">{s.label}</span>
                    <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-gray-300 dark:text-foreground-muted/30">Soon</span>
                  </div>
                  <p className="text-[11px] text-gray-300 dark:text-foreground-muted/30 leading-relaxed">{s.description}</p>
                </div>
              );
            }

            return (
              <Link
                key={s.href}
                href={s.href}
                className="p-[10px] rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-500 dark:text-foreground-muted" />
                  <span className="text-xs font-medium text-gray-900 dark:text-foreground">{s.label}</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-foreground-muted leading-relaxed">{s.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </NewPageWrapper>
  );
}
