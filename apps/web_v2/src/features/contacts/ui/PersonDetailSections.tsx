'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  formatAddressForLookup,
  parsePersonDetailSections,
  personDetailHasSections,
  type PersonDetailLine,
} from '@/features/contacts/logic/parsePersonDetail';
import { ContactSaveBadge } from '@/features/contacts/ui/ContactSaveBadge';
import type { ContactCandidate } from '@/features/contacts/logic/identifyCandidates';
import {
  addressIdentityKey,
  personIdentityKey,
} from '@/features/contacts/logic/identifyCandidates';
import { getPeoId } from '@/lib/people/personExpansion';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { DockSection } from '@/features/map/dockCore/panes/DockPaneShell';
import { IconHome, IconPhone, IconUser, IconEnvelope } from '@/features/map/dockCore/core/icons';
import { ToolPrimaryButton } from '@/features/tools/core/toolUi';

const BUCKET_CLASS = `overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`;

function Bucket({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <DockSection title={title} subtitle={subtitle}>
      <div className={BUCKET_CLASS}>{children}</div>
    </DockSection>
  );
}

function BucketRow({
  title,
  subtitle,
  icon,
  trailing,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-black/[0.06] px-3.5 py-3 last:border-b-0">
      {icon ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lake-blue/10 text-lake-blue">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium leading-snug text-foreground break-words">
          {title}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-foreground-muted break-words">
            {subtitle}
          </span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0 self-center">{trailing}</span> : null}
    </div>
  );
}

function ShowMore({
  total,
  shown,
  onToggle,
  expanded,
}: {
  total: number;
  shown: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (total <= shown && !expanded) return null;
  const hidden = total - shown;
  return (
    <div className="border-t border-black/[0.06] px-3 py-2">
      <ToolPrimaryButton variant="secondary" onClick={onToggle}>
        {expanded ? 'Show less' : `Show ${hidden} more`}
      </ToolPrimaryButton>
    </div>
  );
}

function lineToPersonCandidate(line: PersonDetailLine): ContactCandidate {
  const first =
    typeof line.raw.FirstName === 'string'
      ? line.raw.FirstName
      : typeof line.raw.firstName === 'string'
        ? line.raw.firstName
        : undefined;
  const last =
    typeof line.raw.LastName === 'string'
      ? line.raw.LastName
      : typeof line.raw.lastName === 'string'
        ? line.raw.lastName
        : undefined;
  const displayName = line.title;
  return {
    kind: 'person',
    key: personIdentityKey({
      firstName: first,
      lastName: last,
      displayName,
    }),
    displayName,
    firstName: first,
    lastName: last,
    emails: [],
    phones: [],
    subtitle: line.subtitle,
    raw: {
      ...line.raw,
      peo_id: getPeoId(line.raw) ?? undefined,
      Name: displayName,
    },
  };
}

function lineToAddressCandidate(line: PersonDetailLine): ContactCandidate {
  const label = formatAddressForLookup(line.raw) || line.title;
  const line1 =
    (typeof line.raw.streetAddress === 'string' && line.raw.streetAddress) ||
    (typeof line.raw.street_address === 'string' && line.raw.street_address) ||
    undefined;
  const city =
    (typeof line.raw.addressLocality === 'string' && line.raw.addressLocality) ||
    (typeof line.raw.city === 'string' && line.raw.city) ||
    undefined;
  const state =
    (typeof line.raw.addressRegion === 'string' && line.raw.addressRegion) ||
    (typeof line.raw.state === 'string' && line.raw.state) ||
    undefined;
  const postalCode =
    (typeof line.raw.postalCode === 'string' && line.raw.postalCode) ||
    (typeof line.raw.postal_code === 'string' && line.raw.postal_code) ||
    undefined;
  return {
    kind: 'address',
    key: addressIdentityKey({ line1, city, state, postalCode, label }),
    label,
    line1,
    city,
    state,
    postalCode,
    subtitle: line.subtitle,
    raw: line.raw,
  };
}

/**
 * Structured person-detail view — phones, emails, addresses, relatives, associates.
 */
export function PersonDetailSections({
  payload,
  onSaveCandidate,
}: {
  payload: Record<string, unknown>;
  onSaveCandidate?: (candidate: ContactCandidate) => void;
}) {
  const model = useMemo(() => parsePersonDetailSections(payload), [payload]);
  const [morePrev, setMorePrev] = useState(false);
  const [moreRelatives, setMoreRelatives] = useState(false);
  const [moreAssociates, setMoreAssociates] = useState(false);

  if (!personDetailHasSections(model)) {
    return (
      <DockSection title="Person detail">
        <div className={`${BUCKET_CLASS} px-3.5 py-3`}>
          <p className="text-[13px] text-foreground-muted">
            No structured fields in this pull. Use Identify & save if candidates appear below.
          </p>
        </div>
      </DockSection>
    );
  }

  const prevShown = morePrev ? model.previousAddresses : model.previousAddresses.slice(0, 3);
  const relativesShown = moreRelatives ? model.relatives : model.relatives.slice(0, 5);
  const associatesShown = moreAssociates ? model.associates : model.associates.slice(0, 5);

  return (
    <div className="space-y-5">
      {(model.name || model.age || model.born || model.livesIn || model.peoId) && (
        <DockSection title="Person">
          <div className={`${BUCKET_CLASS} space-y-1 px-3.5 py-3`}>
            {model.name ? (
              <p className="text-[16px] font-semibold text-foreground">{model.name}</p>
            ) : null}
            <p className="text-[12px] text-foreground-muted">
              {[
                model.age ? `Age ${model.age}` : null,
                model.born ? `Born ${model.born}` : null,
                model.livesIn ? `Lives in ${model.livesIn}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Enhanced person record'}
            </p>
            {model.peoId ? (
              <p className="pt-1 font-mono text-[11px] text-foreground-muted">
                ID · {model.peoId}
              </p>
            ) : null}
          </div>
        </DockSection>
      )}

      {model.currentAddresses.length > 0 ? (
        <Bucket title="Current address" subtitle="Most recent known location">
          {model.currentAddresses.map((line) => (
            <BucketRow
              key={line.key}
              title={line.title}
              subtitle={line.subtitle}
              icon={<IconHome className="h-4 w-4" />}
              trailing={
                onSaveCandidate ? (
                  <ContactSaveBadge
                    kind="address"
                    onSave={() => onSaveCandidate(lineToAddressCandidate(line))}
                  />
                ) : undefined
              }
            />
          ))}
        </Bucket>
      ) : null}

      {model.phones.length > 0 ? (
        <Bucket title="Phone numbers">
          {model.phones.map((line) => (
            <BucketRow
              key={line.key}
              title={line.title}
              subtitle={line.subtitle}
              icon={<IconPhone className="h-4 w-4" />}
            />
          ))}
        </Bucket>
      ) : null}

      {model.emails.length > 0 ? (
        <Bucket title="Email addresses">
          {model.emails.map((line) => (
            <BucketRow
              key={line.key}
              title={line.title}
              icon={<IconEnvelope className="h-4 w-4" />}
            />
          ))}
        </Bucket>
      ) : null}

      {model.previousAddresses.length > 0 ? (
        <Bucket title="Past addresses" subtitle={`${model.previousAddresses.length} on file`}>
          {prevShown.map((line) => (
            <BucketRow
              key={line.key}
              title={line.title}
              subtitle={line.subtitle}
              icon={<IconHome className="h-4 w-4" />}
              trailing={
                onSaveCandidate ? (
                  <ContactSaveBadge
                    kind="address"
                    onSave={() => onSaveCandidate(lineToAddressCandidate(line))}
                  />
                ) : undefined
              }
            />
          ))}
          <ShowMore
            total={model.previousAddresses.length}
            shown={3}
            expanded={morePrev}
            onToggle={() => setMorePrev((v) => !v)}
          />
        </Bucket>
      ) : null}

      {model.relatives.length > 0 ? (
        <Bucket title="Related people" subtitle="Relatives">
          {relativesShown.map((line) => (
            <BucketRow
              key={line.key}
              title={line.title}
              subtitle={line.subtitle}
              icon={<IconUser className="h-4 w-4" />}
              trailing={
                onSaveCandidate ? (
                  <ContactSaveBadge
                    kind="person"
                    onSave={() => onSaveCandidate(lineToPersonCandidate(line))}
                  />
                ) : undefined
              }
            />
          ))}
          <ShowMore
            total={model.relatives.length}
            shown={5}
            expanded={moreRelatives}
            onToggle={() => setMoreRelatives((v) => !v)}
          />
        </Bucket>
      ) : null}

      {model.associates.length > 0 ? (
        <Bucket title="Associates" subtitle="Known associations">
          {associatesShown.map((line) => (
            <BucketRow
              key={line.key}
              title={line.title}
              subtitle={line.subtitle}
              icon={<IconUser className="h-4 w-4" />}
              trailing={
                onSaveCandidate ? (
                  <ContactSaveBadge
                    kind="person"
                    onSave={() => onSaveCandidate(lineToPersonCandidate(line))}
                  />
                ) : undefined
              }
            />
          ))}
          <ShowMore
            total={model.associates.length}
            shown={5}
            expanded={moreAssociates}
            onToggle={() => setMoreAssociates((v) => !v)}
          />
        </Bucket>
      ) : null}

      {model.residents.length > 1 ? (
        <Bucket title="Household" subtitle="People listed on this pull">
          {model.residents.map((line) => (
            <BucketRow
              key={line.key}
              title={line.title}
              subtitle={line.subtitle}
              icon={<IconUser className="h-4 w-4" />}
              trailing={
                onSaveCandidate ? (
                  <ContactSaveBadge
                    kind="person"
                    onSave={() => onSaveCandidate(lineToPersonCandidate(line))}
                  />
                ) : undefined
              }
            />
          ))}
        </Bucket>
      ) : null}
    </div>
  );
}
