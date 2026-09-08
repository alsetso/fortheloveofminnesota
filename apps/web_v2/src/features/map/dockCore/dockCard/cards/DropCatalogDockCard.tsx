'use client';

/**
 * Drop Catalog — user's collection of placeable world props.
 *
 * Opens from the "Drop" button in the selected-point toolbar.
 * Picking a model activates WorldPlaceMode for that slug — any subsequent
 * empty-ground tap on the map places that prop at the tapped location.
 */

import { useEffect, useMemo, useState } from 'react';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconSearch, IconDrop } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_FILL_CLASS,
  MAP_DOCK_GLASS_BORDER_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';
import { useWorldCatalog } from '@/features/map/game/world/useWorldCatalog';
import { getPlaceableWorldCatalog } from '@/features/map/game/world/catalogStore';
import { loadWorldCatalog } from '@/features/map/game/world/catalogPersist';
import {
  setWorldPlaceMode,
  getWorldPlaceMode,
} from '@/features/map/game/world/placeModeStore';
import type { WorldModelSpec } from '@/features/map/game/world/catalog';

// ── Helpers ───────────────────────────────────────────────────────────────────

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    animal: 'Animals',
    vehicle: 'Vehicles',
    nature: 'Nature',
    structure: 'Structures',
    item: 'Items',
    sign: 'Signs',
    landmark: 'Landmarks',
  };
  return map[category] ?? category.slice(0, 1).toUpperCase() + category.slice(1);
}

// ── Category chip ─────────────────────────────────────────────────────────────

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition active:scale-95 ${
        active
          ? 'bg-lake-blue text-white'
          : `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground-muted hover:text-foreground`
      }`}
    >
      {label}
    </button>
  );
}

// ── Prop tile ─────────────────────────────────────────────────────────────────

function PropTile({
  model,
  selected,
  onSelect,
}: {
  model: WorldModelSpec;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1.5 rounded-[1.15rem] p-2.5 text-center transition active:scale-[0.97] ${
        selected
          ? 'bg-lake-blue/15 ring-2 ring-lake-blue/60'
          : `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`
      }`}
    >
      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{ height: 80, background: '#0a0a10' }}
      >
        <WorldModelPreviewCanvas
          url={model.url}
          className="absolute inset-0 h-full w-full"
          transparent
        />
        {selected && (
          <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-lake-blue">
            <IconDrop className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
        {model.label}
      </span>
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export default function DropCatalogDockCard() {
  const { closeDockCard } = useMapDock();
  // useWorldCatalog drives reactivity — re-renders on catalog refresh.
  const catalog = useWorldCatalog();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Always fetch fresh catalog data when this card opens so admin changes
  // (e.g. marking a model player_placeable) are visible without a page reload.
  useEffect(() => {
    setRefreshing(true);
    loadWorldCatalog().finally(() => setRefreshing(false));
  }, []);

  // getPlaceableWorldCatalog() is the single source of truth:
  // active + available GLB + admin-confirmed player_placeable === true.
  // Re-derives whenever the catalog store updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const placeable = useMemo(() => getPlaceableWorldCatalog(), [catalog]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const cats: string[] = [];
    for (const m of placeable) {
      if (!seen.has(m.category)) {
        seen.add(m.category);
        cats.push(m.category);
      }
    }
    return cats.sort();
  }, [placeable]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return placeable.filter((m) => {
      if (activeCategory && m.category !== activeCategory) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q) ||
        m.tags.some((t) => t.includes(q))
      );
    });
  }, [placeable, query, activeCategory]);

  // Current active drop mode (so the tile stays highlighted after picking).
  const activeSlug = getWorldPlaceMode();

  function onSelect(model: WorldModelSpec) {
    // Toggle off if already active, otherwise set.
    if (activeSlug === model.slug) {
      setWorldPlaceMode('off');
    } else {
      setWorldPlaceMode(model.slug);
    }
    closeDockCard();
  }

  return (
    <DockCardShell
      titleMode="sub"
      backLabel="Location"
      onBack={closeDockCard}
      title="Drop a prop"
      subtitle={
        refreshing
          ? 'Loading…'
          : placeable.length === 0
            ? 'No props available yet'
            : `${placeable.length} prop${placeable.length === 1 ? '' : 's'}`
      }
      header={
        <div className="space-y-3">
          {/* Search input */}
          <div
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            <IconSearch className="h-4 w-4 shrink-0 text-foreground-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search props"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-foreground-muted"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* Category chips */}
          {categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              <CategoryChip
                label="All"
                active={activeCategory === null}
                onClick={() => setActiveCategory(null)}
              />
              {categories.map((cat) => (
                <CategoryChip
                  key={cat}
                  label={categoryLabel(cat)}
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                />
              ))}
            </div>
          )}
        </div>
      }
    >
      {refreshing && placeable.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
          <p className="text-[13px] text-foreground-muted">Fetching catalog…</p>
        </div>
      ) : placeable.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <IconDrop className="h-10 w-10 text-foreground/20" />
          <p className="text-[14px] font-medium text-foreground-muted">No props in catalog yet</p>
          <p className="max-w-[220px] text-[12px] leading-snug text-foreground/40">
            Placeable 3D props will appear here as they&apos;re added to the world.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-foreground-muted">No matching props</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 pb-4">
          {filtered.map((model) => (
            <PropTile
              key={model.slug}
              model={model}
              selected={activeSlug === model.slug}
              onSelect={() => onSelect(model)}
            />
          ))}
        </div>
      )}

      {/* Hint */}
      <p className="pb-2 text-center text-[11px] leading-relaxed text-foreground/35">
        Pick a prop — then tap any spot on the map to place it there.
        {activeSlug !== 'off' && activeSlug ? (
          <> Tap the selected prop again to cancel.</>
        ) : null}
      </p>
    </DockCardShell>
  );
}
