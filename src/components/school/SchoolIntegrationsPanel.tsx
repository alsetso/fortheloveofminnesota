'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PuzzlePieceIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface SchoolRecord {
  id: string;
  slug: string;
  [key: string]: unknown;
}

interface IntegrationRow {
  id: string;
  provider: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

interface DistrictIntegrationRow {
  provider: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

interface IntegrationsResponse {
  school: IntegrationRow[];
  district: DistrictIntegrationRow[];
}

interface ProviderField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
}

interface SupportedProvider {
  id: string;
  name: string;
  description: string;
  fields: ProviderField[];
}

const SUPPORTED_PROVIDERS: SupportedProvider[] = [
  {
    id: 'nutrislice',
    name: 'Nutrislice',
    description: 'School lunch and breakfast menus',
    fields: [
      { key: 'school_slug', label: 'School Slug', placeholder: 'elk-river-high', required: true },
      { key: 'menu_types.lunch', label: 'Lunch Menu Slug', placeholder: '9-12-lunch', required: true },
      { key: 'menu_types.breakfast', label: 'Breakfast Menu Slug', placeholder: 'k-12-breakfast', required: false },
    ],
  },
];

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[p];
  }
  return typeof current === 'string' ? current : '';
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): Record<string, unknown> {
  const result = { ...obj };
  const parts = path.split('.');
  if (parts.length === 1) {
    result[parts[0]] = value;
    return result;
  }
  const parent = parts[0];
  const rest = parts.slice(1).join('.');
  const child = (typeof result[parent] === 'object' && result[parent] !== null)
    ? { ...(result[parent] as Record<string, unknown>) }
    : {};
  const updated = setNestedValue(child, rest, value);
  result[parent] = updated;
  return result;
}

function flattenConfig(config: Record<string, unknown>): { key: string; value: string }[] {
  const entries: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) {
        if (iv != null && iv !== '') entries.push({ key: `${k}.${ik}`, value: String(iv) });
      }
    } else if (v != null && v !== '') {
      entries.push({ key: k, value: String(v) });
    }
  }
  return entries;
}

export default function SchoolIntegrationsPanel({
  school,
}: {
  school: SchoolRecord;
  canManageSchool: boolean;
}) {
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  const fetchIntegrations = useCallback(() => {
    setLoading(true);
    fetch(`/api/atlas/schools/integrations?schoolSlug=${encodeURIComponent(school.slug)}`)
      .then((r) => (r.ok ? r.json() : { school: [], district: [] }))
      .then((d: IntegrationsResponse) => setData(d))
      .catch(() => setData({ school: [], district: [] }))
      .finally(() => setLoading(false));
  }, [school.slug]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  if (loading) return <IntegrationsSkeleton />;

  const schoolIntegrations = data?.school ?? [];
  const districtIntegrations = data?.district ?? [];
  const connectedProviderIds = new Set(schoolIntegrations.map((r) => r.provider));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <PuzzlePieceIcon className="w-4 h-4 text-foreground-muted" />
        <h2 className="text-sm font-semibold text-foreground">Integrations</h2>
      </div>

      <section className="space-y-2">
        <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
          Active Integrations
        </h3>
        {schoolIntegrations.length === 0 ? (
          <div className="rounded-md border border-border bg-surface p-6 text-center">
            <p className="text-xs text-foreground-muted">No integrations configured yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schoolIntegrations.map((integ) => (
              <ActiveIntegrationCard
                key={integ.id}
                integration={integ}
                onToggle={(enabled) => {
                  fetch(`/api/atlas/schools/integrations/${integ.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled }),
                  })
                    .then((r) => (r.ok ? (r.json() as Promise<IntegrationRow>) : null))
                    .then((updated: IntegrationRow | null) => {
                      if (updated) {
                        setData((prev) =>
                          prev
                            ? {
                                ...prev,
                                school: prev.school.map((row) =>
                                  row.id === updated.id ? { ...row, ...updated } : row,
                                ),
                              }
                            : prev,
                        );
                      }
                    });
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
          Available Integrations
        </h3>
        <div className="space-y-2">
          {SUPPORTED_PROVIDERS.map((provider) => {
            const isConnected = connectedProviderIds.has(provider.id);
            const districtHasProvider = districtIntegrations.some(
              (d) => d.provider === provider.id && d.enabled,
            );
            const isExpanded = expandedProvider === provider.id;

            return (
              <div key={provider.id} className="rounded-md border border-border bg-surface">
                <div className="p-[10px] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{provider.name}</span>
                      {isConnected && (
                        <span className="flex items-center gap-1 text-[9px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          <CheckCircleIcon className="w-3 h-3" />
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-foreground-muted mt-0.5">{provider.description}</p>
                  </div>
                  {!isConnected && districtHasProvider && (
                    <button
                      onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-md border border-border text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors flex-shrink-0"
                    >
                      {isExpanded ? (
                        <>
                          <XMarkIcon className="w-3 h-3" />
                          Cancel
                        </>
                      ) : (
                        <>
                          <PlusIcon className="w-3 h-3" />
                          Add
                        </>
                      )}
                    </button>
                  )}
                </div>

                {!isConnected && !districtHasProvider && (
                  <div className="px-[10px] pb-[10px]">
                    <div className="flex items-center gap-2 rounded-md border border-amber-300/40 bg-amber-500/5 px-3 py-2">
                      <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-[10px] text-amber-700 dark:text-amber-300">
                        Your district hasn&apos;t been set up for {provider.name} yet. Contact support to get started.
                      </span>
                    </div>
                  </div>
                )}

                {isExpanded && !isConnected && districtHasProvider && (
                  <AddIntegrationForm
                    provider={provider}
                    schoolSlug={school.slug}
                    onSuccess={() => {
                      setExpandedProvider(null);
                      fetchIntegrations();
                    }}
                    onCancel={() => setExpandedProvider(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ActiveIntegrationCard({
  integration,
  onToggle,
}: {
  integration: IntegrationRow;
  onToggle: (enabled: boolean) => void;
}) {
  const entries = flattenConfig(integration.config);
  const providerDef = SUPPORTED_PROVIDERS.find((p) => p.id === integration.provider);
  const displayName = providerDef?.name ?? integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1);

  return (
    <div className="rounded-md border border-border bg-surface p-[10px] space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">{displayName}</span>
          <span
            className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
              integration.enabled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-surface-accent text-foreground-subtle'
            }`}
          >
            {integration.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <button
          onClick={() => onToggle(!integration.enabled)}
          className={`relative w-8 h-[18px] rounded-full transition-colors ${
            integration.enabled
              ? 'bg-emerald-500'
              : 'bg-foreground-subtle/30'
          }`}
        >
          <span
            className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
              integration.enabled ? 'left-[15px]' : 'left-[2px]'
            }`}
          />
        </button>
      </div>
      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map(({ key, value }) => {
            const fieldDef = providerDef?.fields.find((f) => f.key === key);
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-foreground-muted">{fieldDef?.label ?? key}</span>
                <span className="text-[10px] text-foreground font-mono">{value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddIntegrationForm({
  provider,
  schoolSlug,
  onSuccess,
  onCancel,
}: {
  provider: SupportedProvider;
  schoolSlug: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    for (const field of provider.fields) {
      if (field.required && !getNestedValue(values, field.key)) {
        setError(`${field.label} is required`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/atlas/schools/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolSlug,
          provider: provider.id,
          config: values,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setError(body?.error ?? 'Failed to create integration');
        return;
      }
      onSuccess();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-border p-[10px] space-y-3">
      <div className="space-y-2">
        {provider.fields.map((field) => (
          <div key={field.key}>
            <label className="text-[10px] font-medium text-foreground-muted block mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
              type="text"
              placeholder={field.placeholder}
              value={getNestedValue(values, field.key)}
              onChange={(e) => setValues((prev) => setNestedValue(prev, field.key, e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs text-foreground bg-surface border border-border rounded-md placeholder:text-foreground-subtle focus:outline-none focus:ring-1 focus:ring-foreground-muted/30"
            />
          </div>
        ))}
      </div>
      {error && (
        <p className="text-[10px] text-red-500">{error}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-[10px] font-medium text-foreground-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3 py-1.5 text-[10px] font-medium rounded-md bg-foreground text-surface hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Connect'}
        </button>
      </div>
    </div>
  );
}

function IntegrationsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-surface-accent animate-pulse" />
        <div className="h-4 w-28 rounded bg-surface-accent animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-surface-accent animate-pulse" />
        <div className="rounded-md border border-border bg-surface p-[10px] space-y-2">
          <div className="h-4 w-24 rounded bg-surface-accent animate-pulse" />
          <div className="h-3 w-48 rounded bg-surface-accent animate-pulse" />
          <div className="h-3 w-36 rounded bg-surface-accent animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-40 rounded bg-surface-accent animate-pulse" />
        <div className="rounded-md border border-border bg-surface p-[10px] space-y-2">
          <div className="h-4 w-20 rounded bg-surface-accent animate-pulse" />
          <div className="h-3 w-52 rounded bg-surface-accent animate-pulse" />
        </div>
      </div>
    </div>
  );
}
