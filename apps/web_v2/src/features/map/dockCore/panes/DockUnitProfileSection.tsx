'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconPencil } from '@/features/map/dockCore/core/icons';
import {
  DockSection,
  ENTRY_ROW_GLASS_CLASS,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { TOOL_FIELD_CLASS } from '@/features/tools/core/toolUi';

/** Atlas kinds whose feature id matches territory.units.id. */
const UNIT_BACKED_KINDS = new Set<DockEntity['kind']>([
  'county',
  'ctu',
  'school_district',
  'district',
  'senate_district',
  'house_district',
]);

type UnitProfile = {
  description: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  population: number | null;
  features: { best?: string[]; worst?: string[] };
  editable?: boolean;
};

type FieldKey =
  | 'description'
  | 'website_url'
  | 'contact_email'
  | 'contact_phone'
  | 'population'
  | 'best'
  | 'worst';

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function listToLines(items?: string[]): string {
  return (items ?? []).join('\n');
}

function linesToList(raw: string): string[] {
  return raw
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fieldDraft(profile: UnitProfile | null, key: FieldKey): string {
  switch (key) {
    case 'description':
      return profile?.description ?? '';
    case 'website_url':
      return profile?.website_url ?? '';
    case 'contact_email':
      return profile?.contact_email ?? '';
    case 'contact_phone':
      return profile?.contact_phone ?? '';
    case 'population':
      return profile?.population != null ? String(profile.population) : '';
    case 'best':
      return listToLines(profile?.features?.best);
    case 'worst':
      return listToLines(profile?.features?.worst);
  }
}

function ProfileRow({
  label,
  value,
  editAction,
}: {
  label: string;
  value: ReactNode;
  editAction?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
          {label}
        </p>
        {editAction}
      </div>
      <div className="mt-0.5 text-sm leading-snug text-foreground break-words">
        {value}
      </div>
    </div>
  );
}

/**
 * Foundation About fields on territory.units.
 * Users: read-only when data exists (hidden when empty).
 * place_ai on: same read-only rows + inline pencil to edit each field.
 */
export function DockUnitProfileSection({ entity }: { entity: DockEntity }) {
  const { stack } = useMapDock();
  const top = stack[stack.length - 1];
  const isTopDetails =
    top?.id === 'details' && top.entity.id === entity.id;
  const [profile, setProfile] = useState<UnitProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!UNIT_BACKED_KINDS.has(entity.kind)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/territory/units/${entity.id}/profile`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as UnitProfile & {
        error?: string;
      };
      if (!res.ok) {
        setProfile(null);
        return;
      }
      setProfile({
        description: json.description ?? null,
        website_url: json.website_url ?? null,
        contact_email: json.contact_email ?? null,
        contact_phone: json.contact_phone ?? null,
        population: json.population ?? null,
        features: json.features ?? {},
        editable: Boolean(json.editable),
      });
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [entity.id, entity.kind]);

  useEffect(() => {
    if (isTopDetails) void load();
  }, [isTopDetails, load]);

  useEffect(() => {
    setEditingKey(null);
    setDraft('');
    setError(null);
  }, [entity.id]);

  const beginEdit = (key: FieldKey) => {
    setError(null);
    setDraft(fieldDraft(profile, key));
    setEditingKey(key);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft('');
    setError(null);
  };

  const saveField = async (key: FieldKey) => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> =
        key === 'best'
          ? { features: { best: linesToList(draft) } }
          : key === 'worst'
            ? { features: { worst: linesToList(draft) } }
            : key === 'population'
              ? { population: draft.trim() || null }
              : { [key]: draft };

      const res = await fetch(`/api/territory/units/${entity.id}/profile`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as UnitProfile & {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? 'Could not save');
        return;
      }
      setProfile({
        description: json.description ?? null,
        website_url: json.website_url ?? null,
        contact_email: json.contact_email ?? null,
        contact_phone: json.contact_phone ?? null,
        population: json.population ?? null,
        features: json.features ?? {},
        editable: true,
      });
      setEditingKey(null);
      setDraft('');
    } catch {
      setError('Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!UNIT_BACKED_KINDS.has(entity.kind)) return null;

  const canEdit = Boolean(profile?.editable);
  const showAdminEditor = Boolean(profile?.editable);
  const hasPublic =
    Boolean(profile?.description?.trim()) ||
    Boolean(profile?.website_url?.trim()) ||
    Boolean(profile?.contact_email?.trim()) ||
    Boolean(profile?.contact_phone?.trim()) ||
    profile?.population != null;
  const hasFeatures =
    Boolean(profile?.features?.best?.length) ||
    Boolean(profile?.features?.worst?.length);
  const hasAny = hasPublic || hasFeatures;

  if (loading && !profile) {
    return (
      <DockSection
        title="About"
        subtitle="Public place details."
      >
        <p className="px-0.5 text-sm text-foreground-muted">Loading…</p>
      </DockSection>
    );
  }


  const empty = (
    <span className="text-foreground-muted">Not set</span>
  );

  const editButton = (key: FieldKey, label: string) =>
    canEdit ? (
      <button
        type="button"
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        onClick={() => beginEdit(key)}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lake-blue hover:bg-map-ink-subtle"
      >
        <IconPencil className="h-3.5 w-3.5" />
      </button>
    ) : null;

  const fieldEditor = (key: FieldKey, opts: {
    multiline?: boolean;
    rows?: number;
    type?: string;
    inputMode?: 'numeric';
    placeholder?: string;
  }) => {
    const inputClass = opts.multiline
      ? `${TOOL_FIELD_CLASS} h-auto min-h-[4.5rem] resize-y py-2.5`
      : TOOL_FIELD_CLASS;
    return (
      <div className="space-y-2 pt-1">
        {opts.multiline ? (
          <textarea
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            rows={opts.rows ?? 3}
            className={inputClass}
            placeholder={opts.placeholder}
            autoFocus
          />
        ) : (
          <input
            type={opts.type ?? 'text'}
            inputMode={opts.inputMode}
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            className={inputClass}
            placeholder={opts.placeholder}
            autoFocus
          />
        )}
        {error && editingKey === key ? (
          <p className="text-[12px] text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveField(key)}
            className="flex-1 rounded-xl bg-lake-blue px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancelEdit}
            className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold text-foreground ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  type DisplayField = {
    key: FieldKey;
    label: string;
    display: ReactNode;
    hasValue: boolean;
    editor: ReactNode;
  };

  const fields: DisplayField[] = [
    {
      key: 'description',
      label: 'Overview',
      hasValue: Boolean(profile?.description?.trim()),
      display: profile?.description?.trim() || empty,
      editor: fieldEditor('description', {
        multiline: true,
        placeholder: 'Short public description',
      }),
    },
    {
      key: 'website_url',
      label: 'Website',
      hasValue: Boolean(profile?.website_url?.trim()),
      display: profile?.website_url?.trim() ? (
        <a
          href={profile.website_url.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lake-blue underline-offset-2 hover:underline"
        >
          {hostLabel(profile.website_url.trim())}
        </a>
      ) : (
        empty
      ),
      editor: fieldEditor('website_url', {
        type: 'url',
        placeholder: 'https://',
      }),
    },
    {
      key: 'contact_email',
      label: 'Email',
      hasValue: Boolean(profile?.contact_email?.trim()),
      display: profile?.contact_email?.trim() ? (
        <a
          href={`mailto:${profile.contact_email.trim()}`}
          className="text-lake-blue underline-offset-2 hover:underline"
        >
          {profile.contact_email.trim()}
        </a>
      ) : (
        empty
      ),
      editor: fieldEditor('contact_email', {
        type: 'email',
        placeholder: 'contact@example.gov',
      }),
    },
    {
      key: 'contact_phone',
      label: 'Phone',
      hasValue: Boolean(profile?.contact_phone?.trim()),
      display: profile?.contact_phone?.trim() ? (
        <a
          href={`tel:${profile.contact_phone.trim().replace(/[^\d+]/g, '')}`}
          className="text-lake-blue underline-offset-2 hover:underline"
        >
          {profile.contact_phone.trim()}
        </a>
      ) : (
        empty
      ),
      editor: fieldEditor('contact_phone', {
        type: 'tel',
        placeholder: '(555) 555-5555',
      }),
    },
    {
      key: 'population',
      label: 'Population',
      hasValue: profile?.population != null,
      display:
        profile?.population != null
          ? profile.population.toLocaleString()
          : empty,
      editor: fieldEditor('population', {
        inputMode: 'numeric',
        placeholder: 'e.g. 425000',
      }),
    },
    {
      key: 'best',
      label: 'Best',
      hasValue: Boolean(profile?.features?.best?.length),
      display: profile?.features?.best?.length
        ? profile.features.best.join('; ')
        : empty,
      editor: fieldEditor('best', {
        multiline: true,
        placeholder: 'Parks\nSchools',
      }),
    },
    {
      key: 'worst',
      label: 'Challenges',
      hasValue: Boolean(profile?.features?.worst?.length),
      display: profile?.features?.worst?.length
        ? profile.features.worst.join('; ')
        : empty,
      editor: fieldEditor('worst', {
        multiline: true,
        placeholder: 'Housing\nTransit',
      }),
    },
  ];

  const visibleFields = showAdminEditor
    ? fields
    : fields.filter((f) => f.hasValue);

  return (
    <DockSection
      title="About"
      subtitle={
        showAdminEditor
          ? canEdit
            ? 'Public place details — tap pencil to edit.'
            : 'Sign in as admin (or use localhost) to edit.'
          : 'Public place details.'
      }
    >
      <div className={`space-y-2.5 rounded-2xl px-3.5 py-3 ${ENTRY_ROW_GLASS_CLASS}`}>
        {visibleFields.map((field) => {
          const editing = editingKey === field.key;
          return (
            <ProfileRow
              key={field.key}
              label={field.label}
              editAction={
                showAdminEditor && !editing
                  ? editButton(field.key, field.label)
                  : undefined
              }
              value={editing ? field.editor : field.display}
            />
          );
        })}
      </div>
    </DockSection>
  );
}
