'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, UserIcon, BuildingOfficeIcon, PencilSquareIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useFormState } from '@/hooks/useFormState';
import FormInput from '@/features/civic/components/FormInput';
import FormTextarea from '@/features/civic/components/FormTextarea';
import ImageUpload from '@/features/civic/components/ImageUpload';
import { useGovToast } from '@/app/gov/contexts/GovToastContext';

export interface GovPeopleRecord {
  id: string;
  name: string;
  slug: string | null;
  party: string | null;
  photo_url: string | null;
  district: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  building_id: string | null;
  created_at?: string;
  roles?: string[];
}

interface BuildingInfo {
  name: string | null;
  type: string | null;
  full_address: string | null;
}

interface GovPeopleModalProps {
  record: GovPeopleRecord | null;
  onClose: () => void;
  onSave?: () => void;
  isAdmin?: boolean;
}

/**
 * Modal for person details. Admin can create/edit inline.
 */
export default function GovPeopleModal({ record, onClose, onSave, isAdmin = false }: GovPeopleModalProps) {
  const supabase = useSupabaseClient();
  const { showPending, showSuccess, showError } = useGovToast();
  const isCreate = record === null;
  const canEdit = isAdmin && (isCreate || record);
  const { formData, updateField, setFormData } = useFormState({
    name: record?.name ?? '',
    slug: record?.slug ?? '',
    party: record?.party ?? '',
    district: record?.district ?? '',
    title: record?.title ?? '',
    email: record?.email ?? '',
    phone: record?.phone ?? '',
    address: record?.address ?? '',
    photo_url: record?.photo_url ?? '',
    building_id: record?.building_id ?? '',
  });
  const [building, setBuilding] = useState<BuildingInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminPreview, setAdminPreview] = useState(false);

  useEffect(() => {
    if (record) {
      setFormData({
        name: record.name,
        slug: record.slug ?? '',
        party: record.party ?? '',
        district: record.district ?? '',
        title: record.title ?? '',
        email: record.email ?? '',
        phone: record.phone ?? '',
        address: record.address ?? '',
        photo_url: record.photo_url ?? '',
        building_id: record.building_id ?? '',
      });
    } else if (isCreate) {
      setFormData({
        name: '',
        slug: '',
        party: '',
        district: '',
        title: '',
        email: '',
        phone: '',
        address: '',
        photo_url: '',
        building_id: '',
      });
    }
  }, [record, isCreate, setFormData]);

  const buildingIdToFetch = record?.building_id ?? (adminPreview && formData.building_id.trim() ? formData.building_id.trim() : null);
  useEffect(() => {
    if (!buildingIdToFetch || (canEdit && !adminPreview)) {
      setBuilding(null);
      return;
    }
    let cancelled = false;
    const civic = typeof (supabase as any).schema === 'function' ? (supabase as any).schema('civic') : supabase;
    civic
      .from('buildings')
      .select('name, type, full_address')
      .eq('id', buildingIdToFetch)
      .single()
      .then(({ data, error: e }) => {
        if (!cancelled && !e && data) {
          setBuilding({
            name: data.name ?? null,
            type: data.type ?? null,
            full_address: data.full_address ?? null,
          });
        } else if (!cancelled) {
          setBuilding(null);
        }
      });
    return () => { cancelled = true; };
  }, [buildingIdToFetch, canEdit, adminPreview, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    showPending('Saving…');
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || null,
        party: formData.party.trim() || null,
        district: formData.district.trim() || null,
        title: formData.title.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        photo_url: formData.photo_url.trim() || null,
        building_id: formData.building_id.trim() || null,
      };
      if (isCreate) {
        const res = await fetch('/api/gov/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
      } else if (record) {
        const res = await fetch(`/api/gov/people/${record.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
      }
      showSuccess();
      onSave?.();
      onClose();
    } catch (err) {
      showError();
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const showForm = canEdit && !adminPreview;
  const displayRecord = record ?? {
    name: formData.name,
    slug: formData.slug,
    party: formData.party,
    district: formData.district,
    title: formData.title,
    email: formData.email,
    phone: formData.phone,
    address: formData.address,
    photo_url: formData.photo_url,
    building_id: formData.building_id,
    roles: record?.roles,
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-md w-full max-w-md max-h-[85vh] overflow-hidden shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-3 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            {isCreate ? 'New person' : 'Person'}
          </h2>
          <div className="flex items-center gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => setAdminPreview((p) => !p)}
                className="text-xs px-2 py-1 rounded border border-border text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors flex items-center gap-1"
              >
                {adminPreview ? (
                  <>
                    <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
                  </>
                ) : (
                  <>
                    <EyeIcon className="w-3.5 h-3.5" /> Preview
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-surface-accent text-foreground-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-3 overflow-y-auto space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-2">
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Media section: upload auto-saves to preview list; removable; saved with form on Submit */}
              <div className="space-y-2 pb-3 border-b border-border">
                <label className="block text-[10px] font-medium text-foreground">Media</label>
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="relative">
                    <ImageUpload
                      currentUrl={formData.photo_url || undefined}
                      pathPrefix={record?.id ? `people/${record.id}` : 'people'}
                      onUpload={(url) => updateField('photo_url', url)}
                      onError={(err) => setError(err.message)}
                      size="lg"
                    />
                    {formData.photo_url ? (
                      <button
                        type="button"
                        onClick={() => updateField('photo_url', '')}
                        className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors z-10"
                        aria-label="Remove photo"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-foreground-muted mb-0.5">Or paste image URL</p>
                  <input
                    type="url"
                    value={formData.photo_url}
                    onChange={(e) => updateField('photo_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full text-xs border border-border rounded px-2 py-1 bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-foreground-muted"
                  />
                </div>
              </div>
              <FormInput label="Name" value={formData.name} onChange={(v) => updateField('name', v)} required />
              <FormInput label="Slug" value={formData.slug} onChange={(v) => updateField('slug', v)} />
              <FormInput label="Party" value={formData.party} onChange={(v) => updateField('party', v)} />
              <FormInput label="District" value={formData.district} onChange={(v) => updateField('district', v)} />
              <FormInput label="Title" value={formData.title} onChange={(v) => updateField('title', v)} />
              <FormInput label="Email" value={formData.email} onChange={(v) => updateField('email', v)} type="email" />
              <FormInput label="Phone" value={formData.phone} onChange={(v) => updateField('phone', v)} />
              <FormTextarea label="Address" value={formData.address} onChange={(v) => updateField('address', v)} rows={2} />
              <FormInput label="Building ID (UUID)" value={formData.building_id} onChange={(v) => updateField('building_id', v)} />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 text-xs px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-surface-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 text-xs px-3 py-1.5 rounded-md bg-foreground text-surface hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          ) : (record || (canEdit && adminPreview)) ? (
            <>
              <div className="flex items-center gap-3">
                {displayRecord.photo_url ? (
                  <img src={displayRecord.photo_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-surface-accent flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-foreground-muted" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{displayRecord.name}</p>
                  {displayRecord.title && <p className="text-xs text-foreground-muted">{displayRecord.title}</p>}
                </div>
              </div>
              {displayRecord.slug && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Slug</p>
                  <p className="text-sm text-foreground">{displayRecord.slug}</p>
                </div>
              )}
              {displayRecord.party && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Party</p>
                  <p className="text-sm text-foreground">{displayRecord.party}</p>
                </div>
              )}
              {displayRecord.district && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">District</p>
                  <p className="text-sm text-foreground">{displayRecord.district}</p>
                </div>
              )}
              {record.roles && record.roles.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Roles</p>
                  <p className="text-sm text-foreground">{record.roles.join(', ')}</p>
                </div>
              )}
              {displayRecord.email && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Email</p>
                  <a href={`mailto:${displayRecord.email}`} className="text-sm text-foreground hover:underline break-all">
                    {displayRecord.email}
                  </a>
                </div>
              )}
              {displayRecord.phone && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Phone</p>
                  <a href={`tel:${displayRecord.phone}`} className="text-sm text-foreground hover:underline">
                    {displayRecord.phone}
                  </a>
                </div>
              )}
              {displayRecord.address && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Address</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{displayRecord.address}</p>
                </div>
              )}
              {displayRecord.building_id && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Building</p>
                  {building ? (
                    <div className="text-sm text-foreground flex items-start gap-1.5">
                      <BuildingOfficeIcon className="w-4 h-4 text-foreground-muted flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{building.name || building.type || 'Unnamed building'}</p>
                        {building.type && building.name && (
                          <p className="text-foreground-muted text-xs">{building.type}</p>
                        )}
                        {building.full_address && (
                          <p className="text-foreground-muted text-xs mt-0.5">{building.full_address}</p>
                        )}
                      </div>
                    </div>
                  ) : adminPreview ? (
                    <p className="text-sm font-mono text-foreground-muted">{displayRecord.building_id}</p>
                  ) : (
                    <p className="text-sm text-foreground-muted">Loading…</p>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
