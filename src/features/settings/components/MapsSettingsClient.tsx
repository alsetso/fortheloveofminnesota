'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapIcon, PlusIcon, Cog6ToothIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { getMapUrl } from '@/lib/maps/urls';
import { useToast } from '@/features/ui/hooks/useToast';

interface OwnedMapRow {
  id: string;
  name: string;
  slug: string | null;
  visibility: string;
  member_count: number | null;
  href: string;
}

const FULL_ACCESS_PLANS = new Set(['contributor', 'gov']);

export default function MapsSettingsClient() {
  const router = useRouter();
  const { account, mapLimit } = useSettings();
  const { success } = useToast();
  const [ownedMaps, setOwnedMaps] = useState<OwnedMapRow[]>([]);
  const [loading, setLoading] = useState(true);

  const plan = account?.plan?.toLowerCase() ?? null;
  const isAdmin = account?.role === 'admin';
  const hasFullAccess = isAdmin || (plan !== null && FULL_ACCESS_PLANS.has(plan));
  const isContributor = plan === 'contributor' && !isAdmin;

  useEffect(() => {
    if (!account?.id) {
      setOwnedMaps([]);
      setLoading(false);
      return;
    }
    const fetchOwned = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/maps?account_id=${account.id}`);
        if (!response.ok) throw new Error('Failed to fetch maps');
        const data = await response.json();
        const maps = (data.maps || [])
          .filter((m: { account_id: string }) => m.account_id === account.id)
          .map((m: { id: string; name?: string; slug?: string | null; custom_slug?: string | null; visibility?: string; member_count?: number | null }) => ({
            id: m.id,
            name: m.name || 'Untitled Map',
            slug: m.slug || m.custom_slug || null,
            visibility: m.visibility || 'private',
            member_count: m.member_count ?? null,
            href: getMapUrl({ id: m.id, slug: m.slug, custom_slug: m.custom_slug }),
          }));
        setOwnedMaps(maps);
      } catch {
        setOwnedMaps([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOwned();
  }, [account?.id]);

  const ownedMapsCount = ownedMaps.length;
  const canCreate = ownedMapsCount < mapLimit;
  const displayText = `${ownedMapsCount} / ${mapLimit} maps`;

  if (hasFullAccess) {
    return (
      <div className="space-y-3">
        {/* Plan & map limits — from accounts.plan server-side: hobby=1, contributor=5 */}
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <h3 className="text-sm font-semibold text-foreground mb-2">Map limits</h3>
          <p className="text-xs text-foreground/70 mb-2">{displayText}</p>
          {!canCreate && (
            <Link href="/pricing" className="text-xs font-medium text-lake-blue hover:underline">
              Upgrade to create more maps
            </Link>
          )}
        </div>

        {/* Create new map placeholder */}
        <Link
          href={canCreate ? '/maps/new' : '#'}
          onClick={(e) => {
            if (!canCreate) {
              e.preventDefault();
              router.push('/pricing');
            }
          }}
          className={`block bg-surface border border-border-muted dark:border-white/10 rounded-md p-6 flex flex-col items-center justify-center gap-2 transition-colors ${
            canCreate ? 'hover:bg-surface-accent' : 'opacity-70 cursor-default'
          }`}
        >
          <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border-muted dark:border-white/20 flex items-center justify-center">
            <PlusIcon className="w-6 h-6 text-foreground/60" aria-hidden />
          </div>
          <span className="text-xs font-medium text-foreground/70">
            {canCreate ? 'Create new map' : 'Map limit reached'}
          </span>
        </Link>

        {/* Owner permissions table: maps you own */}
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
          <h3 className="text-sm font-semibold text-foreground px-[10px] py-3 border-b border-border-muted dark:border-white/10">
            Maps you own
          </h3>
          {loading ? (
            <div className="px-[10px] py-4 text-xs text-foreground/60">Loading...</div>
          ) : ownedMaps.length === 0 ? (
            <div className="px-[10px] py-4 text-xs text-foreground/60">No maps yet. Create one above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-muted dark:border-white/10 bg-surface-accent">
                    <th className="text-left px-[10px] py-2 font-semibold text-foreground">Name</th>
                    <th className="text-left px-[10px] py-2 font-semibold text-foreground">Visibility</th>
                    <th className="text-left px-[10px] py-2 font-semibold text-foreground">Members</th>
                    <th className="text-right px-[10px] py-2 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ownedMaps.map((map) => (
                    <tr key={map.id} className="border-b border-border-muted dark:border-white/10 last:border-b-0 hover:bg-surface-accent">
                      <td className="px-[10px] py-2 text-foreground font-medium truncate max-w-[120px]">
                        {map.name}
                      </td>
                      <td className="px-[10px] py-2 text-foreground/70 capitalize">{map.visibility}</td>
                      <td className="px-[10px] py-2 text-foreground/70">{map.member_count ?? 0}</td>
                      <td className="px-[10px] py-2 text-right">
                        <span className="inline-flex items-center gap-1">
                          <Link
                            href={map.href}
                            className="text-foreground/70 hover:text-foreground inline-flex items-center gap-0.5"
                            title="View map"
                          >
                            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                            View
                          </Link>
                          <span className="text-foreground/30">|</span>
                          <Link
                            href={`${map.href}/settings`}
                            className="text-foreground/70 hover:text-foreground inline-flex items-center gap-0.5"
                            title="Map settings"
                          >
                            <Cog6ToothIcon className="w-3 h-3" />
                            Settings
                          </Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Link
          href="/maps"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground bg-surface border border-border-muted dark:border-white/20 hover:bg-surface-accent rounded-md transition-colors"
        >
          <MapIcon className="w-3 h-3" />
          Go to Maps
        </Link>
      </div>
    );
  }

  // Contributor plan: feature coming soon
  return (
    <div className="space-y-3">
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-foreground mb-2">Maps</h3>
        <p className="text-xs text-foreground/70 mb-3">
          Custom map creation and management is coming soon for Contributor accounts.
        </p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium text-foreground/60 bg-surface-accent border border-border-muted dark:border-white/10 rounded">
            Coming soon
          </span>
          <Link href="/pricing" className="text-xs font-medium text-lake-blue hover:underline">
            Upgrade for immediate access
          </Link>
        </div>
      </div>

      {ownedMaps.length > 0 && (
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
          <h3 className="text-sm font-semibold text-foreground px-[10px] py-3 border-b border-border-muted dark:border-white/10">
            Maps you own
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-muted dark:border-white/10 bg-surface-accent">
                  <th className="text-left px-[10px] py-2 font-semibold text-foreground">Name</th>
                  <th className="text-left px-[10px] py-2 font-semibold text-foreground">Visibility</th>
                  <th className="text-right px-[10px] py-2 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ownedMaps.map((map) => (
                  <tr key={map.id} className="border-b border-border-muted dark:border-white/10 last:border-b-0 hover:bg-surface-accent">
                    <td className="px-[10px] py-2 text-foreground font-medium truncate max-w-[120px]">
                      {map.name}
                    </td>
                    <td className="px-[10px] py-2 text-foreground/70 capitalize">{map.visibility}</td>
                    <td className="px-[10px] py-2 text-right">
                      <Link
                        href={map.href}
                        className="text-foreground/70 hover:text-foreground inline-flex items-center gap-0.5"
                        title="View map"
                      >
                        <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
