'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { XMarkIcon, PencilSquareIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useFormState } from '@/hooks/useFormState';
import FormInput from '@/features/civic/components/FormInput';
import FormTextarea from '@/features/civic/components/FormTextarea';
import FormSelect from '@/features/civic/components/FormSelect';
import ImageListUpload from '@/features/civic/components/ImageListUpload';
import { useGovToast } from '@/app/gov/contexts/GovToastContext';

export interface GovBuildingRecord {
  id: string;
  type: string | null;
  name: string | null;
  description: string | null;
  full_address: string | null;
  lat?: number | null;
  lng?: number | null;
  website: string | null;
  created_at?: string;
  cover_images?: string[] | null;
}

interface GovBuildingModalProps {
  record: GovBuildingRecord | null;
  onClose: () => void;
  onSave?: () => void;
  isAdmin?: boolean;
  /** Branch for "More Details" link (default: executive) */
  branch?: string;
}

const BUILDING_TYPES = [
  { value: 'state', label: 'state' },
  { value: 'city', label: 'city' },
  { value: 'town', label: 'town' },
  { value: 'federal', label: 'federal' },
];

/**
 * Modal for building details. Rendered via portal. Admin can create/edit inline.
 */
export default function GovBuildingModal({ record, onClose, onSave, isAdmin = false, branch = 'executive' }: GovBuildingModalProps) {
  const supabase = useSupabaseClient();
  const { showPending, showSuccess, showError } = useGovToast();
  const isCreate = record === null;
  const canEdit = isAdmin && (isCreate || !!record);
  if (!record && !isAdmin) return null;
  const { formData, updateField, setFormData } = useFormState({
    type: record?.type ?? '',
    name: record?.name ?? '',
    description: record?.description ?? '',
    full_address: record?.full_address ?? '',
    lat: record?.lat != null ? String(record.lat) : '',
    lng: record?.lng != null ? String(record.lng) : '',
    website: record?.website ?? '',
    cover_images: record?.cover_images?.length ? record.cover_images.join(', ') : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminPreview, setAdminPreview] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (record) {
      setFormData({
        type: record.type ?? '',
        name: record.name ?? '',
        description: record.description ?? '',
        full_address: record.full_address ?? '',
        lat: record.lat != null ? String(record.lat) : '',
        lng: record.lng != null ? String(record.lng) : '',
        website: record.website ?? '',
        cover_images: record.cover_images?.length ? record.cover_images.join(', ') : '',
      });
    } else if (isCreate) {
      setFormData({
        type: '',
        name: '',
        description: '',
        full_address: '',
        lat: '',
        lng: '',
        website: '',
        cover_images: '',
      });
    }
  }, [record, isCreate, setFormData]);

  const getCivic = () =>
    typeof (supabase as any).schema === 'function' ? (supabase as any).schema('civic') : supabase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (isCreate && !formData.type.trim()) {
      setError('Type is required');
      return;
    }
    setSaving(true);
    setError(null);
    showPending('Saving…');
    try {
      const civic = getCivic();
      const coverArr = formData.cover_images.trim() ? formData.cover_images.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const payload = {
        type: formData.type.trim() || (record?.type ?? null),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        full_address: formData.full_address.trim() || null,
        lat: formData.lat.trim() ? parseFloat(formData.lat) : null,
        lng: formData.lng.trim() ? parseFloat(formData.lng) : null,
        website: formData.website.trim() || null,
        cover_images: coverArr.length ? coverArr : null,
      };
      if (isCreate) {
        const { error: insertError } = await civic.from('buildings').insert(payload);
        if (insertError) throw insertError;
      } else if (record) {
        const { error: updateError } = await civic.from('buildings').update(payload).eq('id', record.id);
        if (updateError) throw updateError;
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

  const displayName = record?.name || record?.type || 'Unnamed building';
  const showForm = canEdit && !adminPreview;
  const coverArr = formData.cover_images.trim()
    ? formData.cover_images.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const displayRecord = record ?? {
    name: formData.name,
    type: formData.type,
    description: formData.description,
    full_address: formData.full_address,
    lat: formData.lat ? parseFloat(formData.lat) : null,
    lng: formData.lng ? parseFloat(formData.lng) : null,
    website: formData.website,
    cover_images: coverArr.length ? coverArr : null,
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-md w-full max-w-md max-h-[85vh] overflow-hidden shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-3 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            {isCreate ? 'New building' : (record?.name ?? record?.type ?? 'Building')}
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
        {!showForm && displayRecord?.cover_images && displayRecord.cover_images.length > 0 && (
          <div className="flex-shrink-0">
            <div className="w-full aspect-video bg-surface-accent overflow-hidden">
              <img src={displayRecord.cover_images[activeImageIndex] ?? displayRecord.cover_images[0]} alt="" className="w-full h-full object-cover" />
            </div>
            {displayRecord.cover_images.length > 1 && (
              <ul className="flex gap-1 p-2 overflow-x-auto border-b border-border">
                {displayRecord.cover_images.map((url, i) => (
                  <li key={i} className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex(i)}
                      className={`w-12 h-12 rounded overflow-hidden border-2 transition-colors ${i === activeImageIndex ? 'border-foreground' : 'border-border hover:border-foreground-muted'}`}
                      aria-label={`View image ${i + 1}`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="p-3 overflow-y-auto space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-2">
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <FormSelect
                label="Type"
                value={formData.type}
                onChange={(v) => updateField('type', v)}
                options={isCreate ? [{ value: '', label: 'Select type' }, ...BUILDING_TYPES] : BUILDING_TYPES}
                required={isCreate}
              />
              <FormInput label="Name" value={formData.name} onChange={(v) => updateField('name', v)} required />
              <FormTextarea
                label="Description"
                value={formData.description}
                onChange={(v) => updateField('description', v)}
                rows={3}
              />
              <FormInput
                label="Full address"
                value={formData.full_address}
                onChange={(v) => updateField('full_address', v)}
              />
              <FormInput label="Latitude" value={formData.lat} onChange={(v) => updateField('lat', v)} />
              <FormInput label="Longitude" value={formData.lng} onChange={(v) => updateField('lng', v)} />
              <FormInput label="Website" value={formData.website} onChange={(v) => updateField('website', v)} type="url" />
              <ImageListUpload
                label="Cover images"
                value={coverArr}
                onChange={(urls) => updateField('cover_images', urls.join(', '))}
                pathPrefix={record?.id ? `buildings/${record.id}` : 'buildings'}
                onError={(err) => setError(err.message)}
              />
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
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-semibold text-foreground">{displayRecord.name || displayName}</p>
                {displayRecord.type && (
                  <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border border-border text-foreground-muted uppercase tracking-wide">
                    {displayRecord.type}
                  </span>
                )}
              </div>
              {displayRecord.full_address && (
                <div className="flex items-start gap-1.5">
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(displayRecord.full_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all flex-1"
                  >
                    {displayRecord.full_address}
                  </a>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(displayRecord.full_address!)}
                    className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-border text-foreground-muted hover:text-foreground hover:bg-surface-accent transition-colors mt-0.5"
                    aria-label="Copy address"
                  >
                    Copy
                  </button>
                </div>
              )}
              {displayRecord.description && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Description</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{displayRecord.description}</p>
                </div>
              )}
              {displayRecord.lat != null && displayRecord.lng != null && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Coordinates</p>
                  <p className="text-sm text-foreground font-mono">
                    {Number(displayRecord.lat).toFixed(5)}, {Number(displayRecord.lng).toFixed(5)}
                  </p>
                </div>
              )}
              {displayRecord.website && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Website</p>
                  <a
                    href={displayRecord.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {displayRecord.website}
                  </a>
                </div>
              )}
              {!isCreate && record?.id && (
                <Link
                  href={`/gov/${branch}/building/${record.id}`}
                  className="block w-full text-center text-sm font-semibold px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors mt-2"
                >
                  More Details
                </Link>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
