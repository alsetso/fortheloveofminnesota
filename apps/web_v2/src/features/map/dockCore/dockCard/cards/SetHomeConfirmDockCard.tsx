'use client';

import { useState, type ReactNode } from 'react';
import { HOME_RESET_COOLDOWN_DAYS } from '@/features/accountTerritories/store/constants';
import {
  formatHomeResetDate,
  useHomeStatus,
} from '@/features/accountTerritories/store/useHomeStatus';
import { useAuthSafe } from '@/features/auth';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useTerritoriesAroundMe } from '@/features/map/territory/territoriesAroundMeStore';
import { ToolCostNote, ToolPrimaryButton } from '@/features/tools/core/toolUi';

/**
 * Set-as-home confirmation panel — opened from Controls when Territories
 * around me is on. Commits those jurisdictions as home base; the 30-day
 * cooldown gates both this UI and the server.
 */
export default function SetHomeConfirmDockCard() {
  const { openDockCard } = useMapDock();
  const { account } = useAuthSafe();
  const { coords, jurisdictions } = useTerritoriesAroundMe();
  const { status, reload } = useHomeStatus();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const hasHome = Boolean(status?.homeSetAt);
  const canAct = !hasHome || Boolean(status?.canReset);

  const backToControls = () => openDockCard('controls');

  const onConfirm = async () => {
    if (!coords || jurisdictions.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account-territories/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          confirm: true,
          jurisdictions: jurisdictions.map((j) => ({
            id: j.id,
            kind: j.kind,
            name: j.name,
            kindLabel: j.kindLabel,
          })),
        }),
      });
      const json = (await res.json()) as { error?: string; action?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not set home');
        return;
      }
      setDoneMessage(
        json.action === 'reset'
          ? 'Home areas updated.'
          : 'Home areas set — local government unlocked.',
      );
      await reload();
    } catch {
      setError('Could not set home');
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (!account) {
    body = (
      <p className="px-0.5 text-center text-[13px] text-foreground-muted">
        Sign in to set where you live. Setting home unlocks local government
        details for your area.
      </p>
    );
  } else if (doneMessage) {
    body = (
      <div className="space-y-3">
        <p className="px-0.5 text-center text-[13px] font-medium text-lake-blue">
          {doneMessage}
        </p>
        <p className="px-0.5 text-center text-[12px] text-foreground-muted">
          These areas are now locked as Lives here places for{' '}
          {HOME_RESET_COOLDOWN_DAYS} days.
        </p>
      </div>
    );
  } else if (!coords || jurisdictions.length === 0) {
    body = (
      <p className="px-0.5 text-center text-[13px] text-foreground-muted">
        Turn on Find Me, then Areas around me from Map layers, then set
        home from your live position.
      </p>
    );
  } else if (!canAct) {
    body = (
      <p className="px-0.5 text-center text-[13px] text-foreground-muted">
        Home is locked until{' '}
        <span className="font-semibold text-foreground">
          {formatHomeResetDate(status?.homeResetAvailableAt)}
        </span>
        . Home can only be reset once every {HOME_RESET_COOLDOWN_DAYS} days.
      </p>
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="px-0.5 text-[13px] leading-snug text-foreground">
          You&apos;re setting{' '}
          <span className="font-semibold">home base territories</span> from
          your live position. This unlocks local government for this area and
          locks these as Lives here places for the next{' '}
          {HOME_RESET_COOLDOWN_DAYS} days. You can only reset once every{' '}
          {HOME_RESET_COOLDOWN_DAYS} days.
        </p>
        <ul className="space-y-1 px-0.5 text-[12px] text-foreground-muted">
          {jurisdictions.map((j) => (
            <li key={`${j.kind}:${j.id}`}>
              <span className="font-medium text-foreground">{j.name}</span>
              {j.kindLabel ? ` · ${j.kindLabel}` : null}
            </li>
          ))}
        </ul>
        <ToolCostNote>
          Commits {jurisdictions.length} jurisdictions as your home base for{' '}
          {HOME_RESET_COOLDOWN_DAYS} days.
        </ToolCostNote>
      </div>
    );
  }

  const footer =
    doneMessage ? (
      <ToolPrimaryButton variant="secondary" disabled={busy} onClick={backToControls}>
        Back to Map layers
      </ToolPrimaryButton>
    ) : canAct && coords && jurisdictions.length > 0 && account ? (
      <div className="space-y-3">
        <ToolPrimaryButton loading={busy} disabled={busy} onClick={() => void onConfirm()}>
          {hasHome ? 'I understand — reset home' : 'I understand — set home'}
        </ToolPrimaryButton>
        <ToolPrimaryButton variant="secondary" disabled={busy} onClick={backToControls}>
          Cancel
        </ToolPrimaryButton>
      </div>
    ) : (
      <ToolPrimaryButton variant="secondary" disabled={busy} onClick={backToControls}>
        Cancel
      </ToolPrimaryButton>
    );

  return (
    <DockCardShell
      variant="confirm"
      titleMode="center"
      eyebrow="Home"
      title="Set as home"
      footer={footer}
    >
      {body}
      {error ? (
        <p className="px-0.5 text-center text-[12px] text-red-600">{error}</p>
      ) : null}
    </DockCardShell>
  );
}
