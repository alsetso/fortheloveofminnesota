'use client';

import { useMemo, useState } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { DockPaneShell } from '@/features/map/dockCore/panes/DockPaneShell';
import { IconChevronRight, IconHome } from '@/features/map/dockCore/core/icons';
import { TOOL_CREDIT_COSTS } from '@/features/tools/core/toolCreditCosts';
import {
  ToolCostNote,
  ToolPrimaryButton,
  ToolStatusLine,
} from '@/features/tools/core/toolUi';
import OutOfCreditsDialog from '@/features/tools/wallet/OutOfCreditsDialog';
import { useWalletSummary } from '@/features/tools/wallet/useWalletSummary';
import type { OpenToolResultHandler } from '@/features/tools/lookup/openToolResult';

const INSET =
  'overflow-hidden rounded-[10px] border border-black/[0.08] bg-white';
const FIELD_INSET =
  'w-full bg-transparent px-4 py-3 text-[17px] text-foreground outline-none placeholder:text-foreground-muted/45';

type PropertyHit = {
  lookupId: string;
  label: string;
};

/**
 * Address / property lookup — one Search (property), then optional owner deepen.
 * Results stay on-page; tap to review → confirm → save.
 */
export default function AddressLookupPane({
  initialQuery,
  onOpenToolResult,
}: {
  initialQuery?: string;
  /** Own-tab host: open results in-page instead of the map dock. */
  onOpenToolResult?: OpenToolResultHandler;
}) {
  const { openSubpage } = useMapDock();
  const { refresh: refreshWallet } = useWalletSummary();
  const [address, setAddress] = useState((initialQuery ?? '').trim());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<'property' | 'owners' | null>(null);
  const [hit, setHit] = useState<PropertyHit | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);

  const canSearch = useMemo(() => address.trim().length >= 8, [address]);

  const openPropertyResult = (
    lookupId: string,
    title: string,
    mode: 'zillow' | 'skiptrace',
  ) => {
    if (onOpenToolResult) {
      onOpenToolResult({
        title,
        subtitle: mode === 'zillow' ? 'Property' : 'Owners',
        archiveKind: 'properties',
        lookupId,
      });
      return;
    }
    openSubpage({
      title,
      subtitle: mode === 'zillow' ? 'Property' : 'Owners',
      kind: 'tool-result',
      slug: `properties:${lookupId}`,
    });
  };

  async function runLookup(mode: 'zillow' | 'skiptrace') {
    if (!canSearch || busy) return;
    setBusy(true);
    setBusyKind(mode === 'zillow' ? 'property' : 'owners');
    setStatus(null);
    try {
      const res = await fetch('/api/realestate/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address: address.trim(), mode }),
      });
      const json = (await res.json()) as {
        lookupId?: string | null;
        cached?: boolean;
        creditsCharged?: number;
        address?: string;
        error?: string;
      };

      if (res.status === 402) {
        setOutOfCredits(true);
        setStatus('Not enough credits.');
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Lookup failed');

      await refreshWallet();
      const lookupId = json.lookupId;
      if (!lookupId) throw new Error('No result id returned');

      const label = json.address ?? address.trim();
      setHit({ lookupId, label });

      if (mode === 'skiptrace') {
        openPropertyResult(lookupId, label, 'skiptrace');
        return;
      }
      // Property: stay on-page — tap the result row to review.
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  }

  return (
    <DockPaneShell>
      <OutOfCreditsDialog open={outOfCredits} onClose={() => setOutOfCredits(false)} />
      <div className="space-y-6 px-3 pb-6 pt-1">
        <section>
          <div className={INSET}>
            <input
              className={FIELD_INSET}
              placeholder="123 Main St, Minneapolis, MN"
              value={address}
              autoComplete="street-address"
              onChange={(e) => {
                setAddress(e.target.value);
                setStatus(null);
                setHit(null);
              }}
            />
          </div>
        </section>

        <div className="space-y-2">
          <ToolPrimaryButton
            credits={TOOL_CREDIT_COSTS.realEstateProperty}
            disabled={!canSearch || busy}
            loading={busyKind === 'property'}
            onClick={() => void runLookup('zillow')}
          >
            Search
          </ToolPrimaryButton>
          <ToolCostNote>
            {TOOL_CREDIT_COSTS.realEstateProperty} credit · property details · cached
            repeats free
          </ToolCostNote>
        </div>

        {status ? <ToolStatusLine>{status}</ToolStatusLine> : null}

        {hit ? (
          <section className="space-y-3">
            <p className="px-1 text-[13px] font-normal uppercase tracking-wide text-foreground-muted">
              Result
            </p>
            <ul className={INSET}>
              <li>
                <button
                  type="button"
                  onClick={() => openPropertyResult(hit.lookupId, hit.label, 'zillow')}
                  className="flex w-full items-center gap-3 bg-transparent px-4 py-3 text-left transition active:bg-black/[0.04]"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue">
                    <IconHome className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] text-foreground">
                      {hit.label}
                    </span>
                    <span className="block truncate text-[13px] text-foreground-muted">
                      Property · tap to review
                    </span>
                  </span>
                  <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/40" />
                </button>
              </li>
            </ul>

            <div className="space-y-2">
              <ToolPrimaryButton
                variant="secondary"
                credits={TOOL_CREDIT_COSTS.realEstateOwner}
                disabled={!canSearch || busy}
                loading={busyKind === 'owners'}
                onClick={() => void runLookup('skiptrace')}
              >
                Get owner info
              </ToolPrimaryButton>
              <ToolCostNote>
                {TOOL_CREDIT_COSTS.realEstateOwner} credit · optional deepen
              </ToolCostNote>
            </div>
          </section>
        ) : null}
      </div>
    </DockPaneShell>
  );
}
