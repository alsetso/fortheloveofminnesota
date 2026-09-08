'use client';

import type { DockPane } from '@/features/map/dockCore/core/dockPanes';
import { DockPaneShell, DockSection } from '@/features/map/dockCore/panes/DockPaneShell';
import { TerritoryRecordsList, type TerritorySlug } from '@/features/map/territory';
import PeopleLookupPane from '@/features/tools/lookup/PeopleLookupPane';
import AddressLookupPane from '@/features/tools/lookup/AddressLookupPane';
import SavedContactsPane from '@/features/tools/lookup/SavedContactsPane';
import CreditsPane from '@/features/tools/lookup/CreditsPane';
import BuyCreditsPane from '@/features/tools/lookup/BuyCreditsPane';
import ToolResultSheet from '@/features/tools/lookup/ToolResultSheet';
import ContactConfirmPane from '@/features/contacts/ui/ContactConfirmPane';
import ContactDetailPane from '@/features/contacts/ui/ContactDetailPane';
import ContactEnrichmentPane from '@/features/contacts/ui/ContactEnrichmentPane';
import DockTerritoryAiPane from '@/features/map/dockCore/panes/DockTerritoryAiPane';
import DockPageFoundationPane from '@/features/map/dockCore/panes/DockPageFoundationPane';

/** Nested dock views — territory, contact-book tools, pages. */
export default function DockSubpagePane({
  pane,
}: {
  pane: Extract<DockPane, { id: 'subpage' }>;
}) {
  if (pane.kind === 'page-launch') {
    return (
      <DockPageFoundationPane mode="launch" title={pane.title} slug={pane.slug} />
    );
  }

  if (pane.kind === 'page-manage') {
    return (
      <DockPageFoundationPane mode="manage" title={pane.title} slug={pane.slug} />
    );
  }

  if (pane.kind === 'territory-records' && pane.slug) {
    return <TerritoryRecordsList slug={pane.slug as TerritorySlug} />;
  }

  if (pane.kind === 'people') {
    return <PeopleLookupPane initialQuery={pane.query} />;
  }

  if (pane.kind === 'addresses') {
    return <AddressLookupPane initialQuery={pane.query} />;
  }

  if (pane.kind === 'saved') {
    const view =
      pane.slug === 'people' || pane.slug === 'addresses' || pane.slug === 'places'
        ? pane.slug
        : 'hub';
    return <SavedContactsPane initialView={view} initialQuery={pane.query} />;
  }

  if (pane.kind === 'my-places') {
    return <SavedContactsPane initialView="places" />;
  }

  if (pane.kind === 'credits') {
    return <CreditsPane />;
  }

  if (pane.kind === 'buy-credits') {
    return <BuyCreditsPane />;
  }

  if (pane.kind === 'tool-result') {
    return <ToolResultSheet pane={pane} />;
  }

  if (pane.kind === 'contact-confirm') {
    return <ContactConfirmPane />;
  }

  if (pane.kind === 'contact-detail') {
    return <ContactDetailPane pane={pane} />;
  }

  if (pane.kind === 'contact-enrichment') {
    return <ContactEnrichmentPane pane={pane} />;
  }

  if (pane.kind === 'territory-ai') {
    return <DockTerritoryAiPane pane={pane} />;
  }

  return (
    <DockPaneShell>
      <div className="space-y-5 pb-6">
        <DockSection title={pane.title} subtitle={pane.subtitle ?? pane.kind}>
          <p className="px-0.5 text-sm text-foreground-muted">
            Coming soon — <span className="font-medium text-foreground">{pane.kind}</span>
          </p>
        </DockSection>
      </div>
    </DockPaneShell>
  );
}
