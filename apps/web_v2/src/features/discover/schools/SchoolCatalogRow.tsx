'use client';

import { IconPlus } from '@/features/map/dockCore/core/icons';
import type { SchoolCatalogRow } from '@/lib/schools/types';

export function SchoolCatalogRow({
  row,
  added,
  showAdd,
  busyKey,
  onAdd,
  onMap,
}: {
  row: SchoolCatalogRow;
  added: boolean;
  showAdd: boolean;
  busyKey: string | null;
  onAdd: () => void;
  onMap: () => void;
}) {
  const adding = busyKey === `add:${row.id}`;

  return (
    <div className="flex w-full items-center gap-2 px-5 py-3">
      <button
        type="button"
        onClick={onMap}
        className="min-w-0 flex-1 text-left transition active:opacity-70"
      >
        <span className="block truncate text-[16px] font-semibold text-foreground">
          {row.name}
        </span>
        {row.subtitle ? (
          <span className="mt-0.5 block truncate text-[13px] text-foreground-muted">
            {row.subtitle}
          </span>
        ) : null}
      </button>
      {showAdd ? (
        <button
          type="button"
          disabled={added || adding || Boolean(busyKey)}
          onClick={onAdd}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-black/[0.08] px-2.5 py-1.5 text-[12px] font-semibold transition active:opacity-70 disabled:opacity-40"
          aria-label={added ? `${row.name} added` : `Add ${row.name}`}
        >
          {added ? (
            <span className="text-foreground-muted">Added</span>
          ) : (
            <>
              <IconPlus className="h-3 w-3 text-lake-blue" />
              <span className="text-lake-blue">Add</span>
            </>
          )}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onMap}
        className="shrink-0 text-[13px] font-semibold text-lake-blue transition active:opacity-70"
      >
        Map
      </button>
    </div>
  );
}
