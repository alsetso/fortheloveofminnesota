'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import type { ConfirmSaveResult } from '@/features/contacts/ui/ContactConfirmSave';
import PeopleLookupPane from '@/features/tools/lookup/PeopleLookupPane';
import AddressLookupPane from '@/features/tools/lookup/AddressLookupPane';
import ToolResultSheet from '@/features/tools/lookup/ToolResultSheet';
import {
  toolResultSlug,
  type OpenToolResultOpts,
} from '@/features/tools/lookup/openToolResult';
import {
  IconArrowLeft,
  IconMapPin,
  IconPeopleGroup,
} from '@/features/map/dockCore/core/icons';
import { safePadTop } from '@/lib/despia/safeArea';
import { CONTACTS_PATH } from '@/lib/routes/routePolicy';

type PathKind = 'people' | 'addresses';

type Step =
  | { id: 'chooser' }
  | { id: 'compose'; kind: PathKind }
  | {
      id: 'results';
      kind: PathKind;
      title: string;
      subtitle?: string;
      archiveKind: 'people' | 'properties';
      lookupId: string;
    };

function contactsDetailHref(result: ConfirmSaveResult): string {
  const params = new URLSearchParams();
  if (result.kind === 'person') params.set('person', result.id);
  else params.set('address', result.id);
  return `${CONTACTS_PATH}?${params.toString()}`;
}

/** Despia push header — matches Discover subpages (safe area + lake-blue back). */
function ContactsPushHeader({
  title,
  subtitle,
  backLabel = 'Contacts',
  onBack,
  trailing,
}: {
  title: string;
  subtitle?: string | null;
  backLabel?: string;
  onBack: () => void;
  trailing?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
      style={{ paddingTop: safePadTop('0.2rem') }}
    >
      <div className="relative flex h-11 items-center px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={`Back to ${backLabel}`}
          className="relative z-[1] inline-flex h-9 items-center gap-0.5 rounded-full px-1.5 text-lake-blue transition active:opacity-70"
        >
          <IconArrowLeft className="h-5 w-5" />
          <span className="text-[16px] font-semibold">{backLabel}</span>
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 truncate px-24 text-center text-[17px] font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <div className="ml-auto flex min-w-[88px] items-center justify-end">
          {trailing ?? <span className="w-[88px]" aria-hidden />}
        </div>
      </div>
      {subtitle ? (
        <p className="px-4 pb-2 text-center text-[12px] text-foreground-muted">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

/**
 * /contacts/new — Own-tab add ladder: chooser → compose → results → confirm → /contacts.
 * Reuses map lookup panes with in-page navigation (no /game bounce).
 */
export default function ContactsNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seededKind = useMemo((): PathKind | null => {
    const raw = searchParams.get('kind');
    if (raw === 'people' || raw === 'addresses') return raw;
    return null;
  }, [searchParams]);

  const [step, setStep] = useState<Step>(() =>
    seededKind ? { id: 'compose', kind: seededKind } : { id: 'chooser' },
  );

  const goBack = useCallback(() => {
    if (step.id === 'results') {
      setStep({ id: 'compose', kind: step.kind });
      return;
    }
    if (step.id === 'compose') {
      if (seededKind) {
        router.push(CONTACTS_PATH);
        return;
      }
      setStep({ id: 'chooser' });
      return;
    }
    router.push(CONTACTS_PATH);
  }, [router, seededKind, step]);

  const onOpenToolResult = useCallback((opts: OpenToolResultOpts) => {
    const kind: PathKind = opts.archiveKind === 'people' ? 'people' : 'addresses';
    setStep({
      id: 'results',
      kind,
      title: opts.title,
      subtitle: opts.subtitle,
      archiveKind: opts.archiveKind,
      lookupId: opts.lookupId,
    });
  }, []);

  const onComplete = useCallback((result: ConfirmSaveResult) => {
    router.replace(contactsDetailHref(result));
  }, [router]);

  const title =
    step.id === 'chooser'
      ? 'Add contact'
      : step.id === 'compose'
        ? step.kind === 'people'
          ? 'Find someone'
          : 'Look up address'
        : step.title;

  const backLabel =
    step.id === 'compose' && !seededKind
      ? 'Add'
      : step.id === 'results'
        ? step.kind === 'people'
          ? 'Search'
          : 'Address'
        : 'Contacts';

  return (
    <PageScroll>
      <ContactsPushHeader
        title={title}
        subtitle={step.id === 'results' ? step.subtitle : null}
        backLabel={backLabel}
        onBack={goBack}
      />

      {step.id === 'chooser' ? (
        <div className="space-y-3 px-4 pb-10 pt-4">
          <p className="px-1 text-[14px] leading-relaxed text-foreground-muted">
            Search first. Nothing is saved until you confirm a match.
          </p>
          <button
            type="button"
            onClick={() => setStep({ id: 'compose', kind: 'people' })}
            className="flex w-full items-center gap-4 rounded-2xl border border-black/[0.08] bg-white px-4 py-4 text-left shadow-sm transition active:scale-[0.99]"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue">
              <IconPeopleGroup className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold tracking-tight text-foreground">
                Person
              </span>
              <span className="mt-0.5 block text-[13px] text-foreground-muted">
                Name, email, or phone · accounts or public records
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStep({ id: 'compose', kind: 'addresses' })}
            className="flex w-full items-center gap-4 rounded-2xl border border-black/[0.08] bg-white px-4 py-4 text-left shadow-sm transition active:scale-[0.99]"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue">
              <IconMapPin className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold tracking-tight text-foreground">
                Property / owner
              </span>
              <span className="mt-0.5 block text-[13px] text-foreground-muted">
                Address lookup · property facts or skip-trace owners
              </span>
            </span>
          </button>
        </div>
      ) : null}

      {step.id === 'compose' ? (
        <div className="px-1 pb-4">
          {step.kind === 'people' ? (
            <PeopleLookupPane onOpenToolResult={onOpenToolResult} />
          ) : (
            <AddressLookupPane onOpenToolResult={onOpenToolResult} />
          )}
        </div>
      ) : null}

      {step.id === 'results' ? (
        <div className="px-1 pb-4">
          <ToolResultSheet
            key={step.lookupId}
            resultSlug={toolResultSlug(step.archiveKind, step.lookupId)}
            onComplete={onComplete}
          />
        </div>
      ) : null}
    </PageScroll>
  );
}
