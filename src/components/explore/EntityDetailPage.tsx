'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  MapIcon,
  AcademicCapIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  getEntityConfig,
  getEntityConfigById,
  entityUrl,
  type EntityTypeConfig,
  type StatFieldConfig,
  type RelationshipConfig,
} from '@/features/explore/config/entityRegistry';
import { LAYER_SLUGS } from '@/features/map/config/layersConfig';
import MapWidget from '@/components/explore/MapWidget';
import ExploreBreadcrumb from '@/components/explore/ExploreBreadcrumb';

/* ─── helpers ─── */

function formatStatValue(value: unknown, format?: StatFieldConfig['format']): string {
  if (value == null || value === '') return '—';
  switch (format) {
    case 'number':
      return Number(value).toLocaleString();
    case 'area-acres': {
      const acres = Number(value);
      if (isNaN(acres)) return String(value);
      return `${Math.round(acres / 640).toLocaleString()} sq mi`;
    }
    case 'date':
      return new Date(String(value)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    default:
      return String(value);
  }
}

function displayName(record: Record<string, unknown>, config: EntityTypeConfig): string {
  const raw = record[config.nameField];
  if (config.id === 'congressional-districts' && raw != null) return `District ${raw}`;
  return raw != null ? String(raw) : 'Unknown';
}

/* ─── props ─── */

interface EntityDetailPageProps {
  /** Entity type slug (e.g. "counties") */
  entitySlug: string;
  /** Record id or slug */
  recordId: string;
}

/* ─── component ─── */

export default function EntityDetailPage({ entitySlug, recordId }: EntityDetailPageProps) {
  const config = getEntityConfig(entitySlug);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedData, setRelatedData] = useState<Record<string, unknown[]>>({});
  const [relatedLoading, setRelatedLoading] = useState<Record<string, boolean>>({});

  /* ── fetch primary record ── */
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId);

  useEffect(() => {
    if (!config) return;
    setLoading(true);
    setRecord(null);
    setRelatedData({});

    const param = isUUID ? `id=${recordId}` : `slug=${encodeURIComponent(recordId)}`;

    fetch(`${config.apiEndpoint}?${param}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const rec = Array.isArray(data) ? data[0] ?? null : data;
        setRecord(rec);
      })
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [config, recordId, isUUID]);

  /* ── fetch relationships once primary record is loaded ── */
  useEffect(() => {
    if (!config || !record) return;

    config.relationships.forEach((rel) => {
      const params = new URLSearchParams({ limit: '200' });
      if (rel.scopeParam && rel.scopeField) {
        const val = record[rel.scopeField];
        if (val != null) params.set(rel.scopeParam, String(val));
      }

      setRelatedLoading((p) => ({ ...p, [rel.targetType]: true }));

      fetch(`${rel.apiEndpoint}?${params}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          const arr = Array.isArray(data)
            ? data
            : Array.isArray(data?.articles)
              ? data.articles
              : [];
          setRelatedData((p) => ({ ...p, [rel.targetType]: arr }));
        })
        .catch(() => setRelatedData((p) => ({ ...p, [rel.targetType]: [] })))
        .finally(() => setRelatedLoading((p) => ({ ...p, [rel.targetType]: false })));
    });
  }, [config, record]);

  /* ── derived ── */
  const name = record && config ? displayName(record, config) : '';

  const geometry = record?.geometry as GeoJSON.Geometry | null | undefined;

  /* ── aggregated stats for counties (from children) ── */
  const aggregatedStats = useMemo(() => {
    if (!config || config.id !== 'counties') return null;
    const cities = (relatedData['cities-and-towns'] ?? []) as Record<string, unknown>[];
    if (cities.length === 0) return null;
    const pop = cities.reduce((s, c) => s + (Number(c.population) || 0), 0);
    const acres = cities.reduce((s, c) => s + (Number(c.acres) || 0), 0);
    return {
      places: cities.length,
      population: pop,
      area: acres ? `${Math.round(acres / 640).toLocaleString()} sq mi` : null,
    };
  }, [config, relatedData]);

  if (!config) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-6">
        <p className="text-sm text-foreground-muted">Entity type not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto w-full px-4 py-4 space-y-5">
      {/* ── breadcrumb ── */}
      <ExploreBreadcrumb entitySlug={entitySlug} recordName={name || undefined} />

      {loading ? (
        <LoadingSkeleton />
      ) : !record ? (
        <div className="text-center py-12">
          <p className="text-sm text-foreground-muted">Record not found</p>
          <Link
            href={entityUrl(config)}
            className="text-xs text-lake-blue hover:underline mt-2 inline-block"
          >
            ← Back to {config.label}
          </Link>
        </div>
      ) : (
        <>
          {/* ── header ── */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-lg font-bold text-foreground">{name}</h1>
                <span className="text-[10px] text-foreground-subtle bg-surface-accent px-1.5 py-0.5 rounded">
                  {config.singular}
                </span>
              </div>
              <p className="text-xs text-foreground-muted">{config.description}</p>
            </div>
            {config.hasGeometry && LAYER_SLUGS.includes(config.slug) && (
              <Link
                href={`${entityUrl(config, recordId)}?view=map`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors flex-shrink-0"
              >
                <MapIcon className="w-3.5 h-3.5" />
                Map View
              </Link>
            )}
          </div>

          {/* ── atlas profile link (e.g. school building → school profile) ── */}
          {record.atlas_school_slug && (
            <Link
              href={`/explore/schools/${record.atlas_school_slug}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-lake-blue/5 border border-lake-blue/20 text-xs text-lake-blue hover:bg-lake-blue/10 transition-colors"
            >
              <AcademicCapIcon className="w-3.5 h-3.5" />
              View School Profile →
            </Link>
          )}

          {/* ── stats grid ── */}
          {(config.statsFields.length > 0 || aggregatedStats) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {config.statsFields.map((sf) => (
                <StatBlock
                  key={sf.key}
                  label={sf.label}
                  value={formatStatValue(record[sf.key], sf.format)}
                />
              ))}
              {aggregatedStats && (
                <>
                  <StatBlock label="Places" value={String(aggregatedStats.places)} />
                  {aggregatedStats.population > 0 && (
                    <StatBlock
                      label="Population"
                      value={aggregatedStats.population.toLocaleString()}
                    />
                  )}
                  {aggregatedStats.area && (
                    <StatBlock label="Area" value={aggregatedStats.area} />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── inline map ── */}
          {config.hasGeometry && geometry && (
            <section>
              <MapWidget geometry={geometry} height={240} label="Map" />
            </section>
          )}
          {config.hasCoordinates && record.lat != null && record.lng != null && (
            <section>
              <MapWidget lat={Number(record.lat)} lng={Number(record.lng)} height={240} label="Location" />
            </section>
          )}

          {/* ── relationships ── */}
          {config.relationships.map((rel) => (
            <RelationshipSection
              key={rel.targetType}
              rel={rel}
              records={relatedData[rel.targetType] ?? []}
              loading={relatedLoading[rel.targetType] ?? false}
            />
          ))}

          {/* ── back link ── */}
          <div className="pt-2 border-t border-border">
            <Link
              href={entityUrl(config)}
              className="inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="w-3 h-3" />
              All {config.label}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── sub-components ─── */

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-md bg-surface border border-border">
      <div className="text-[10px] text-foreground-muted uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function RelationshipSection({
  rel,
  records,
  loading,
}: {
  rel: RelationshipConfig;
  records: unknown[];
  loading: boolean;
}) {
  const targetConfig = getEntityConfigById(rel.targetType);
  if (!targetConfig) return null;

  const sorted = useMemo(() => {
    const arr = records as Record<string, unknown>[];
    if (targetConfig.id === 'cities-and-towns') {
      return [...arr].sort((a, b) => (Number(b.population) || 0) - (Number(a.population) || 0));
    }
    return arr;
  }, [records, targetConfig.id]);

  const visible = sorted.slice(0, 20);
  const hasMore = sorted.length > 20;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-foreground">{rel.label}</h2>
        {hasMore && (
          <span className="text-[10px] text-foreground-subtle">
            Showing 20 of {sorted.length}
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton rows={5} />
      ) : visible.length === 0 ? (
        <div className="text-xs text-foreground-muted py-4 text-center border border-border rounded-md">
          No {rel.label.toLowerCase()} found
        </div>
      ) : (
        <div className="border border-border rounded-md divide-y divide-border">
          {visible.map((rec, i) => {
            const r = rec as Record<string, unknown>;
            const rName =
              r[targetConfig.nameField] != null ? String(r[targetConfig.nameField]) : 'Unknown';
            const rId = r.id as string | undefined;
            return (
              <Link
                key={rId ?? i}
                href={rId ? `/explore/${targetConfig.slug}/${rId}` : '#'}
                className="flex items-center justify-between px-2.5 py-2 hover:bg-surface-accent transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-foreground-subtle w-5 text-right tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-xs text-foreground group-hover:text-lake-blue transition-colors truncate">
                    {rName}
                  </span>
                  {targetConfig.id === 'cities-and-towns' &&
                    r.ctu_class &&
                    r.ctu_class !== 'CITY' && (
                      <span className="text-[9px] text-foreground-subtle uppercase tracking-wide">
                        {String(r.ctu_class).toLowerCase()}
                      </span>
                    )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {targetConfig.id === 'cities-and-towns' && r.population != null && (
                    <span className="text-[10px] text-foreground-muted tabular-nums">
                      {Number(r.population).toLocaleString()}
                    </span>
                  )}
                  <ChevronRightIcon className="w-3 h-3 text-foreground-subtle" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="border border-border rounded-md divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 px-2.5 flex items-center">
          <div className="h-3 w-2/3 rounded bg-surface-accent animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 rounded bg-surface-accent animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-md bg-surface-accent animate-pulse" />
        ))}
      </div>
      <Skeleton rows={8} />
    </div>
  );
}
