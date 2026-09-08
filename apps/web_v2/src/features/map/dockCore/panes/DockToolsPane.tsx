'use client';

import { useRouter } from 'next/navigation';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  DockActionRow,
  DockPaneShell,
  DockSection,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  IconAddress,
  IconBookmark,
  IconBus,
  IconPeople,
  IconWallet,
} from '@/features/map/dockCore/core/icons';
import {
  CONTACT_BOOK_TOOLS,
  TOOL_UTILITIES,
  type ContactBookToolKind,
} from '@/features/tools/core/contactBookTools';
import {
  formatWalletBalance,
  useWalletSummary,
} from '@/features/tools/wallet/useWalletSummary';
import { settingsBillingPath } from '@/lib/routes/routePolicy';

function toolIcon(kind: ContactBookToolKind) {
  const cls = 'h-5 w-5';
  switch (kind) {
    case 'people':
      return <IconPeople className={cls} />;
    case 'addresses':
      return <IconAddress className={cls} />;
    case 'saved':
      return <IconBookmark className={cls} />;
    case 'credits':
    case 'buy-credits':
      return <IconWallet className={cls} />;
    case 'transit':
      return <IconBus className={cls} />;
  }
}

/** Tools — contact book, billing shortcut, utilities (Game dock hub). */
export default function DockToolsPane() {
  const router = useRouter();
  const { openSubpage, collapse } = useMapDock();
  const { summary, loading } = useWalletSummary();
  const balanceLabel = loading && !summary ? '…' : formatWalletBalance(summary);

  return (
    <DockPaneShell>
      <div className="space-y-5 pb-6">
        <DockSection title="Billing" subtitle="Plan credits and map finds.">
          <DockActionRow
            title={`${balanceLabel} credits`}
            subtitle={
              summary?.isUnlimited
                ? `${summary.planLabel} · unlimited`
                : summary
                  ? `${summary.planLabel} · resets ${summary.resetsOn}`
                  : 'Balance, costs & activity'
            }
            icon={<IconWallet className="h-5 w-5" />}
            onClick={() => {
              collapse();
              router.push(settingsBillingPath());
            }}
          />
        </DockSection>

        <DockSection title="Contact book" subtitle="Look up, save, enrich later.">
          {CONTACT_BOOK_TOOLS.map((tool) => (
            <DockActionRow
              key={tool.kind}
              title={tool.title}
              subtitle={tool.subtitle}
              icon={toolIcon(tool.kind)}
              onClick={() =>
                openSubpage({
                  title: tool.title,
                  subtitle: tool.subtitle,
                  kind: tool.kind,
                })
              }
            />
          ))}
        </DockSection>

        <DockSection title="Utilities">
          {TOOL_UTILITIES.map((tool) => (
            <DockActionRow
              key={tool.kind}
              title={tool.title}
              subtitle={tool.subtitle}
              icon={toolIcon(tool.kind)}
              onClick={() =>
                openSubpage({
                  title: tool.title,
                  subtitle: tool.subtitle,
                  kind: tool.kind,
                })
              }
            />
          ))}
        </DockSection>
      </div>
    </DockPaneShell>
  );
}
