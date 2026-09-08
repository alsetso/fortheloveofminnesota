'use client';

/**
 * Dock body for a live atlas overlay feature (park, school campus, lake, …).
 * Identity lives in the dock chrome; this is About + collection context.
 */

import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  DockSection,
  ENTRY_ROW_GLASS_CLASS,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

export default function DockAtlasFeatureSection({ entity }: { entity: DockEntity }) {
  const collection = entity.kindLabel?.trim() || entity.subtitle?.trim() || 'Atlas';
  const about = entity.summary?.trim() || null;

  return (
    <div className="space-y-5 pb-6">
      <div
        className={`rounded-2xl px-4 py-3.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
          {collection}
        </p>
        <p className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
          {entity.title}
        </p>
        {entity.subtitle && entity.subtitle !== collection ? (
          <p className="mt-1 text-[13px] text-foreground-muted">{entity.subtitle}</p>
        ) : null}
      </div>

      <DockSection title="About" subtitle={about ? undefined : 'No description yet'}>
        {about ? (
          <div className={`rounded-2xl px-3.5 py-3 ${ENTRY_ROW_GLASS_CLASS}`}>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
              {about}
            </p>
          </div>
        ) : (
          <div className={`rounded-2xl px-3.5 py-3 ${ENTRY_ROW_GLASS_CLASS}`}>
            <p className="text-[13px] text-foreground-muted">
              Atlas features pick up blurbs as collections are curated.
            </p>
          </div>
        )}
      </DockSection>
    </div>
  );
}
