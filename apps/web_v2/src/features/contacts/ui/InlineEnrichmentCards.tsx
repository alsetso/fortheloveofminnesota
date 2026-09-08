'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  enrichmentFacts,
  enrichmentKindLabel,
  propertyImageFromPayload,
} from '@/features/contacts/logic/enrichmentFacts';
import {
  parsePersonDetailSections,
  personDetailHasSections,
} from '@/features/contacts/logic/parsePersonDetail';
import { IconChevronRight } from '@/features/map/dockCore/core/icons';

type EnrichmentRef = {
  id: string;
  kind: string;
  label: string;
  summary: Record<string, unknown> | null;
};

type LoadedEnrichment = EnrichmentRef & {
  payload: Record<string, unknown>;
  loading?: boolean;
  error?: string;
};

/** Collapsed-by-default accordion for deepened record sections. */
function AccordionSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-[10px] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-black/[0.04]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] text-foreground">{title}</span>
          {typeof count === 'number' && count > 0 ? (
            <span className="mt-0.5 block text-[13px] text-foreground-muted">
              {count} {count === 1 ? 'item' : 'items'}
            </span>
          ) : null}
        </span>
        <IconChevronRight
          className={`h-4 w-4 shrink-0 text-foreground-muted/40 transition ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>
      {open ? (
        <div className="divide-y divide-black/[0.06] border-t border-black/[0.06] bg-white">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function IosRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="w-[6.5rem] shrink-0 text-[13px] text-foreground-muted">{label}</span>
      <span
        className={`min-w-0 flex-1 text-right text-[15px] leading-snug text-foreground ${
          multiline ? 'whitespace-pre-line text-left' : 'break-words'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function IosLineRow({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[15px] font-medium leading-snug text-foreground">{title}</p>
      {subtitle ? (
        <p className="mt-0.5 text-[13px] leading-snug text-foreground-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

function PersonDetailInline({
  payload,
  omitContactFields,
}: {
  payload: Record<string, unknown>;
  omitContactFields?: boolean;
}) {
  const sections = parsePersonDetailSections(payload);
  if (!personDetailHasSections(sections)) {
    const facts = enrichmentFacts('person_detail', payload);
    if (facts.length === 0) {
      return (
        <p className="px-4 py-3 text-[13px] text-foreground-muted">Detail on file · no rows to show</p>
      );
    }
    return (
      <AccordionSection title="Person detail" count={facts.length}>
        {facts.map((f) => (
          <IosRow key={`${f.label}:${f.value}`} label={f.label} value={f.value} />
        ))}
      </AccordionSection>
    );
  }

  const showPhones = !omitContactFields && sections.phones.length > 0;
  const showEmails = !omitContactFields && sections.emails.length > 0;
  const profileCount = [
    sections.name,
    sections.age,
    sections.born,
    sections.livesIn,
    sections.peoId,
  ].filter(Boolean).length;

  return (
    <div className="space-y-2">
      {profileCount > 0 ? (
        <AccordionSection title="Profile" count={profileCount}>
          {sections.name ? <IosRow label="Name" value={sections.name} /> : null}
          {sections.age ? <IosRow label="Age" value={sections.age} /> : null}
          {sections.born ? <IosRow label="Born" value={sections.born} /> : null}
          {sections.livesIn ? <IosRow label="Lives in" value={sections.livesIn} /> : null}
          {sections.peoId ? <IosRow label="Person ID" value={sections.peoId} /> : null}
        </AccordionSection>
      ) : null}
      {showPhones ? (
        <AccordionSection title="Phones" count={Math.min(sections.phones.length, 12)}>
          {sections.phones.slice(0, 12).map((line) => (
            <IosLineRow key={line.key} title={line.title} subtitle={line.subtitle} />
          ))}
        </AccordionSection>
      ) : null}
      {showEmails ? (
        <AccordionSection title="Emails" count={Math.min(sections.emails.length, 12)}>
          {sections.emails.slice(0, 12).map((line) => (
            <IosLineRow key={line.key} title={line.title} subtitle={line.subtitle} />
          ))}
        </AccordionSection>
      ) : null}
      {sections.currentAddresses.length > 0 ? (
        <AccordionSection
          title="Current addresses"
          count={Math.min(sections.currentAddresses.length, 8)}
        >
          {sections.currentAddresses.slice(0, 8).map((line) => (
            <IosLineRow key={line.key} title={line.title} subtitle={line.subtitle} />
          ))}
        </AccordionSection>
      ) : null}
      {sections.previousAddresses.length > 0 ? (
        <AccordionSection
          title="Previous addresses"
          count={Math.min(sections.previousAddresses.length, 8)}
        >
          {sections.previousAddresses.slice(0, 8).map((line) => (
            <IosLineRow key={line.key} title={line.title} subtitle={line.subtitle} />
          ))}
        </AccordionSection>
      ) : null}
      {sections.relatives.length > 0 ? (
        <AccordionSection title="Relatives" count={Math.min(sections.relatives.length, 10)}>
          {sections.relatives.slice(0, 10).map((line) => (
            <IosLineRow key={line.key} title={line.title} subtitle={line.subtitle} />
          ))}
        </AccordionSection>
      ) : null}
      {sections.associates.length > 0 ? (
        <AccordionSection title="Associates" count={Math.min(sections.associates.length, 10)}>
          {sections.associates.slice(0, 10).map((line) => (
            <IosLineRow key={line.key} title={line.title} subtitle={line.subtitle} />
          ))}
        </AccordionSection>
      ) : null}
    </div>
  );
}

function FactCard({
  kind,
  label,
  payload,
}: {
  kind: string;
  label: string;
  payload: Record<string, unknown>;
}) {
  const facts = enrichmentFacts(kind, payload);
  const image =
    kind === 'property' || kind === 'owner' ? propertyImageFromPayload(payload) : null;

  return (
    <AccordionSection
      title={enrichmentKindLabel(kind) || label}
      count={facts.length > 0 ? facts.length : undefined}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="h-36 w-full object-cover"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : null}
      {facts.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-foreground-muted">Enrichment on file</p>
      ) : (
        facts.map((f) => (
          <IosRow key={`${f.label}:${f.value}`} label={f.label} value={f.value} />
        ))
      )}
    </AccordionSection>
  );
}

/**
 * Loads enrichment payloads and renders them inline as iOS-style grouped cards.
 * When omitPersonContactFields, person_detail phones/emails stay in the main contact form.
 */
export function InlineEnrichmentCards({
  enrichments,
  omitPersonContactFields = false,
}: {
  enrichments: EnrichmentRef[];
  omitPersonContactFields?: boolean;
}) {
  const [loaded, setLoaded] = useState<LoadedEnrichment[]>([]);

  useEffect(() => {
    const ids = enrichments.map((e) => e.id).join(',');
    if (!ids) {
      setLoaded([]);
      return;
    }
    const ac = new AbortController();
    const snapshot = enrichments;
    setLoaded(
      snapshot.map((e) => ({
        ...e,
        payload: {},
        loading: true,
      })),
    );

    void (async () => {
      const results = await Promise.all(
        snapshot.map(async (e) => {
          try {
            const res = await fetch(`/api/contacts/enrichments/${e.id}`, {
              credentials: 'include',
              signal: ac.signal,
              cache: 'no-store',
            });
            const json = (await res.json()) as {
              enrichment?: { payload?: Record<string, unknown> };
              error?: string;
            };
            if (!res.ok) throw new Error(json.error ?? 'Failed to load');
            return {
              ...e,
              payload: json.enrichment?.payload ?? {},
              loading: false,
            } satisfies LoadedEnrichment;
          } catch (err) {
            if (ac.signal.aborted) {
              return { ...e, payload: {}, loading: false };
            }
            return {
              ...e,
              payload: {},
              loading: false,
              error: err instanceof Error ? err.message : 'Failed to load',
            } satisfies LoadedEnrichment;
          }
        }),
      );
      if (!ac.signal.aborted) setLoaded(results);
    })();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when enrichment ids change
  }, [enrichments.map((e) => e.id).join(',')]);

  if (enrichments.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="px-0.5">
        <h2 className="text-sm font-semibold text-foreground">More from records</h2>
        <p className="mt-0.5 text-[12px] text-foreground-muted">
          Tap a section to expand
        </p>
      </div>

      {loaded.map((item) => {
        if (item.loading) {
          return (
            <div
              key={item.id}
              className="h-24 animate-pulse rounded-[1.15rem] bg-black/[0.04]"
            />
          );
        }
        if (item.error) {
          return (
            <AccordionSection key={item.id} title={enrichmentKindLabel(item.kind)} defaultOpen>
              <p className="px-4 py-3 text-[13px] text-red-600">{item.error}</p>
            </AccordionSection>
          );
        }
        if (item.kind === 'person_detail') {
          return (
            <div key={item.id} className="space-y-3">
              <PersonDetailInline
                payload={item.payload}
                omitContactFields={omitPersonContactFields}
              />
            </div>
          );
        }
        return (
          <FactCard
            key={item.id}
            kind={item.kind}
            label={item.label}
            payload={item.payload}
          />
        );
      })}
    </div>
  );
}
