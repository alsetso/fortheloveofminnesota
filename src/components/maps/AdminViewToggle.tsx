'use client';

import { useState, useEffect } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { ShieldCheckIcon as ShieldCheckIconSolid } from '@heroicons/react/24/solid';

interface AdminViewToggleProps {
  isAdmin: boolean;
  isAdminView: boolean;
  onToggle: (isAdminView: boolean) => void;
}

interface PinCounts {
  public: { count: number | null; loading: boolean };
  admin: { count: number | null; loading: boolean };
}

/**
 * Admin-only toggle for switching between Public and Admin pin views
 * Floating in top-left corner of map
 * Shows debug info: schema.table source and pin count
 */
export default function AdminViewToggle({ isAdmin, isAdminView, onToggle }: AdminViewToggleProps) {
  const [pinCounts, setPinCounts] = useState<PinCounts>({
    public: { count: null, loading: false },
    admin: { count: null, loading: false },
  });

  // Fetch pin counts from both sources
  useEffect(() => {
    const fetchCounts = async () => {
      // Fetch public count
      setPinCounts((prev) => ({ ...prev, public: { ...prev.public, loading: true } }));
      try {
        const publicRes = await fetch('/api/maps/live/mentions');
        if (publicRes.ok) {
          const publicData = await publicRes.json();
          setPinCounts((prev) => ({
            ...prev,
            public: { count: publicData.count || 0, loading: false },
          }));
        } else {
          setPinCounts((prev) => ({ ...prev, public: { count: null, loading: false } }));
        }
      } catch (error) {
        console.error('[AdminViewToggle] Error fetching public count:', error);
        setPinCounts((prev) => ({ ...prev, public: { count: null, loading: false } }));
      }

      // Fetch admin count (only if admin)
      if (isAdmin) {
        setPinCounts((prev) => ({ ...prev, admin: { ...prev.admin, loading: true } }));
        try {
          const adminRes = await fetch('/api/maps/live/mentions/admin');
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            setPinCounts((prev) => ({
              ...prev,
              admin: { count: adminData.count || 0, loading: false },
            }));
          } else {
            setPinCounts((prev) => ({ ...prev, admin: { count: null, loading: false } }));
          }
        } catch (error) {
          console.error('[AdminViewToggle] Error fetching admin count:', error);
          setPinCounts((prev) => ({ ...prev, admin: { count: null, loading: false } }));
        }
      }
    };

    fetchCounts();
  }, [isAdmin, isAdminView]); // Refetch when view changes

  if (!isAdmin) return null;

  const currentSource = isAdminView ? 'maps.pins' : 'public.map_pins';
  const currentCount = isAdminView ? pinCounts.admin.count : pinCounts.public.count;
  const isLoading = isAdminView ? pinCounts.admin.loading : pinCounts.public.loading;

  return (
    <div className="absolute top-4 left-4 z-40 pointer-events-auto">
      <button
        onClick={() => onToggle(!isAdminView)}
        className="flex flex-col gap-1 px-3 py-2 bg-surface border border-border-muted dark:border-white/10 rounded-md shadow-lg hover:bg-surface-accent transition-colors text-left"
        title={isAdminView ? 'Switch to Public View' : 'Switch to Admin View'}
      >
        <div className="flex items-center gap-2">
          {isAdminView ? (
            <ShieldCheckIconSolid className="w-4 h-4 text-foreground" />
          ) : (
            <ShieldCheckIcon className="w-4 h-4 text-foreground-muted" />
          )}
          <span className="text-xs font-medium text-foreground">
            {isAdminView ? 'Admin' : 'Public'}
          </span>
        </div>
        <div className="text-[10px] text-foreground-muted space-y-0.5">
          <div className="font-mono">{currentSource}</div>
          <div>
            {isLoading ? (
              <span className="text-foreground-muted/50">Loading...</span>
            ) : currentCount !== null ? (
              <span className="font-semibold text-foreground">{currentCount} pins</span>
            ) : (
              <span className="text-foreground-muted/50">—</span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
