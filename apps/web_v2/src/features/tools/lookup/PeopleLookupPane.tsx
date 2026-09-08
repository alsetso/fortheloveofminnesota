'use client';

import { useMemo, useState } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { DockPaneShell } from '@/features/map/dockCore/panes/DockPaneShell';
import { IconChevronRight, IconUser } from '@/features/map/dockCore/core/icons';
import { TOOL_CREDIT_COSTS } from '@/features/tools/core/toolCreditCosts';
import {
  ToolCostNote,
  ToolPrimaryButton,
  ToolSegmented,
  ToolStatusLine,
} from '@/features/tools/core/toolUi';
import OutOfCreditsDialog from '@/features/tools/wallet/OutOfCreditsDialog';
import { useWalletSummary } from '@/features/tools/wallet/useWalletSummary';
import type { OpenToolResultHandler } from '@/features/tools/lookup/openToolResult';

type PeopleMethod = 'name' | 'email' | 'phone';

type AccountMatch = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  match_type?: 'full' | 'partial';
};

/** After free search: show matches, or offer the single paid deepen step. */
type SearchPhase =
  | { id: 'idle' }
  | { id: 'accounts'; lookupId: string; matches: AccountMatch[] }
  | { id: 'no-accounts' };

const METHODS: { id: PeopleMethod; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
];

const INSET =
  'overflow-hidden rounded-[10px] border border-black/[0.08] bg-white';
const FIELD_INSET =
  'w-full bg-transparent px-4 py-3 text-[17px] text-foreground outline-none placeholder:text-foreground-muted/45';

function parsePeoplePrefill(raw?: string): {
  method: PeopleMethod;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
} {
  const q = (raw ?? '').trim();
  if (!q) {
    return { method: 'name', firstName: '', lastName: '', email: '', phone: '' };
  }
  if (q.includes('@')) {
    return { method: 'email', firstName: '', lastName: '', email: q, phone: '' };
  }
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15 && /[\d(+.\-\s)]/.test(q)) {
    return { method: 'phone', firstName: '', lastName: '', email: '', phone: q };
  }
  const parts = q.split(/\s+/).filter(Boolean);
  return {
    method: 'name',
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    email: '',
    phone: '',
  };
}

function accountDisplayName(a: AccountMatch): string {
  return (
    [a.first_name, a.last_name].filter(Boolean).join(' ').trim() ||
    a.username ||
    'Account'
  );
}

/**
 * People lookup — one Search group, free account check first, paid deepen only
 * when needed. Results stay on-page; tap a row to review → confirm → save.
 * @see docs/contacts-foundation.md
 */
export default function PeopleLookupPane({
  initialQuery,
  onOpenToolResult,
}: {
  initialQuery?: string;
  /** Own-tab host: open results in-page instead of the map dock. */
  onOpenToolResult?: OpenToolResultHandler;
}) {
  const { openSubpage } = useMapDock();
  const { refresh: refreshWallet } = useWalletSummary();
  const seeded = parsePeoplePrefill(initialQuery);
  const [method, setMethod] = useState<PeopleMethod>(seeded.method);
  const [firstName, setFirstName] = useState(seeded.firstName);
  const [lastName, setLastName] = useState(seeded.lastName);
  const [email, setEmail] = useState(seeded.email);
  const [phone, setPhone] = useState(seeded.phone);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<'search' | 'records' | null>(null);
  const [phase, setPhase] = useState<SearchPhase>({ id: 'idle' });
  const [outOfCredits, setOutOfCredits] = useState(false);

  const openPeopleResult = (lookupId: string, title: string) => {
    if (onOpenToolResult) {
      onOpenToolResult({
        title,
        subtitle: 'Review · then confirm to save',
        archiveKind: 'people',
        lookupId,
      });
      return;
    }
    openSubpage({
      title,
      subtitle: 'Review · then confirm to save',
      kind: 'tool-result',
      slug: `people:${lookupId}`,
    });
  };

  const canSearch = useMemo(() => {
    if (method === 'name') return firstName.trim().length > 0 && lastName.trim().length > 0;
    if (method === 'email') return email.trim().includes('@');
    return phone.replace(/\D/g, '').length >= 7;
  }, [method, firstName, lastName, email, phone]);

  const queryLabel = useMemo(() => {
    if (method === 'name') return `${firstName.trim()} ${lastName.trim()}`.trim();
    if (method === 'email') return email.trim();
    return phone.trim();
  }, [method, firstName, lastName, email, phone]);

  function resetResults() {
    setStatus(null);
    setPhase({ id: 'idle' });
  }

  function onMethodChange(next: PeopleMethod) {
    setMethod(next);
    resetResults();
  }

  async function onSearch() {
    if (!canSearch || busy) return;
    setBusy(true);
    setBusyKind('search');
    setStatus(null);
    setPhase({ id: 'idle' });
    try {
      const body =
        method === 'name'
          ? { type: 'name' as const, firstName: firstName.trim(), lastName: lastName.trim() }
          : method === 'email'
            ? { type: 'email' as const, email: email.trim() }
            : { type: 'phone' as const, phone: phone.trim() };

      const res = await fetch('/api/people/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        accounts?: AccountMatch[];
        lookupId?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Lookup failed');

      const list = json.accounts ?? [];
      const lookupId = json.lookupId?.trim() || null;
      if (!lookupId) throw new Error('No result id returned');

      if (list.length === 0) {
        setPhase({ id: 'no-accounts' });
        return;
      }

      setPhase({ id: 'accounts', lookupId, matches: list });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  }

  async function onPublicRecords() {
    if (!canSearch || busy) return;
    setBusy(true);
    setBusyKind('records');
    setStatus(null);
    try {
      const body =
        method === 'name'
          ? {
              type: 'name' as const,
              name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            }
          : method === 'email'
            ? { type: 'email' as const, email: email.trim() }
            : { type: 'phone' as const, phone: phone.trim() };

      const res = await fetch('/api/people/public-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        lookupId?: string | null;
        cached?: boolean;
        creditsCharged?: number;
        error?: string;
      };

      if (res.status === 402) {
        setOutOfCredits(true);
        setStatus('Not enough credits.');
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Public records failed');

      await refreshWallet();
      const lookupId = json.lookupId;
      if (!lookupId) throw new Error('No result id returned');

      openPeopleResult(lookupId, queryLabel || 'Public records');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Public records failed');
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  }

  return (
    <DockPaneShell>
      <OutOfCreditsDialog open={outOfCredits} onClose={() => setOutOfCredits(false)} />
      <div className="space-y-6 px-3 pb-6 pt-1">
        {/* One search group: method + fields */}
        <section className="space-y-2">
          <ToolSegmented options={METHODS} value={method} onChange={onMethodChange} />
          <div className={INSET}>
            {method === 'name' ? (
              <>
                <input
                  className={`${FIELD_INSET} border-b border-black/[0.06]`}
                  placeholder="First name"
                  value={firstName}
                  autoComplete="given-name"
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    resetResults();
                  }}
                />
                <input
                  className={FIELD_INSET}
                  placeholder="Last name"
                  value={lastName}
                  autoComplete="family-name"
                  onChange={(e) => {
                    setLastName(e.target.value);
                    resetResults();
                  }}
                />
              </>
            ) : null}
            {method === 'email' ? (
              <input
                className={FIELD_INSET}
                type="email"
                placeholder="name@example.com"
                value={email}
                autoComplete="email"
                onChange={(e) => {
                  setEmail(e.target.value);
                  resetResults();
                }}
              />
            ) : null}
            {method === 'phone' ? (
              <input
                className={FIELD_INSET}
                type="tel"
                placeholder="(555) 555-5555"
                value={phone}
                autoComplete="tel"
                onChange={(e) => {
                  setPhone(e.target.value);
                  resetResults();
                }}
              />
            ) : null}
          </div>
        </section>

        <ToolPrimaryButton
          credits={TOOL_CREDIT_COSTS.peopleAccountLookup}
          disabled={!canSearch || busy}
          loading={busyKind === 'search'}
          onClick={() => void onSearch()}
        >
          Search
        </ToolPrimaryButton>

        {status ? <ToolStatusLine>{status}</ToolStatusLine> : null}

        {/* Results stay here — tap to open review sheet */}
        {phase.id === 'accounts' ? (
          <section className="space-y-2">
            <p className="px-1 text-[13px] font-normal uppercase tracking-wide text-foreground-muted">
              {phase.matches.length}{' '}
              {phase.matches.length === 1 ? 'match' : 'matches'}
            </p>
            <ul className={INSET}>
              {phase.matches.map((a, i) => {
                const name = accountDisplayName(a);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() =>
                        openPeopleResult(phase.lookupId, queryLabel || name)
                      }
                      className={`flex w-full items-center gap-3 bg-transparent px-4 py-3 text-left transition active:bg-black/[0.04] ${
                        i < phase.matches.length - 1
                          ? 'border-b border-black/[0.06]'
                          : ''
                      }`}
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue">
                        <IconUser className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] text-foreground">
                          {name}
                        </span>
                        <span className="block truncate text-[13px] text-foreground-muted">
                          @{a.username ?? 'user'}
                          {a.match_type ? ` · ${a.match_type}` : ''}
                        </span>
                      </span>
                      <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/40" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="px-1 text-center text-[12px] text-foreground-muted">
              Tap a person to review, then confirm to save.
            </p>
          </section>
        ) : null}

        {/* Paid deepen — only when free search found nothing */}
        {phase.id === 'no-accounts' ? (
          <section className="space-y-3">
            <div className={`${INSET} px-4 py-5 text-center`}>
              <p className="text-[17px] font-semibold text-foreground">No accounts found</p>
              <p className="mt-1 text-[13px] leading-snug text-foreground-muted">
                Nobody on For the Love of Minnesota matched “{queryLabel}”.
              </p>
            </div>
            <div className="space-y-2">
              <ToolPrimaryButton
                variant="secondary"
                credits={TOOL_CREDIT_COSTS.peoplePublicRecords}
                disabled={!canSearch || busy}
                loading={busyKind === 'records'}
                onClick={() => void onPublicRecords()}
              >
                Search public records
              </ToolPrimaryButton>
              <ToolCostNote>
                {TOOL_CREDIT_COSTS.peoplePublicRecords} credit · cached repeats free
              </ToolCostNote>
            </div>
          </section>
        ) : null}
      </div>
    </DockPaneShell>
  );
}
