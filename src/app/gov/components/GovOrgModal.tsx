'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useFormState } from '@/hooks/useFormState';
import FormInput from '@/features/civic/components/FormInput';
import FormTextarea from '@/features/civic/components/FormTextarea';
import FormSelect from '@/features/civic/components/FormSelect';
import { useGovToast } from '@/app/gov/contexts/GovToastContext';

export interface GovOrgRecord {
  id: string;
  name: string;
  slug: string;
  org_type: string | null;
  parent_id: string | null;
  description: string | null;
  website: string | null;
  created_at?: string;
}

interface GovOrgModalProps {
  record: GovOrgRecord | null;
  onClose: () => void;
  onSave?: () => void;
  isAdmin?: boolean;
}

const ORG_TYPES = [
  { value: 'branch', label: 'branch' },
  { value: 'agency', label: 'agency' },
  { value: 'department', label: 'department' },
  { value: 'court', label: 'court' },
];

/**
 * Modal for organization details. Rendered via portal. Admin can create/edit inline.
 */
export default function GovOrgModal({ record, onClose, onSave, isAdmin = false }: GovOrgModalProps) {
  const supabase = useSupabaseClient();
  const { showPending, showSuccess, showError } = useGovToast();
  const isCreate = record === null;
  const canEdit = isAdmin && (isCreate || record);
  const { formData, updateField, setFormData } = useFormState({
    name: record?.name ?? '',
    slug: record?.slug ?? '',
    org_type: record?.org_type ?? '',
    parent_id: record?.parent_id ?? '',
    description: record?.description ?? '',
    website: record?.website ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setFormData({
        name: record.name,
        slug: record.slug,
        org_type: record.org_type ?? '',
        parent_id: record.parent_id ?? '',
        description: record.description ?? '',
        website: record.website ?? '',
      });
    } else if (isCreate) {
      setFormData({
        name: '',
        slug: '',
        org_type: '',
        parent_id: '',
        description: '',
        website: '',
      });
    }
  }, [record, isCreate, setFormData]);

  const getCivic = () =>
    typeof (supabase as any).schema === 'function' ? (supabase as any).schema('civic') : supabase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (isCreate && !formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (isCreate && !formData.slug.trim()) {
      setError('Slug is required');
      return;
    }
    if (isCreate && !formData.org_type.trim()) {
      setError('Type is required');
      return;
    }
    setSaving(true);
    setError(null);
    showPending('Saving…');
    try {
      const civic = getCivic();
      if (isCreate) {
        const { error: insertError } = await civic.from('agencies').insert({
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          org_type: formData.org_type || null,
          parent_id: formData.parent_id.trim() || null,
          description: formData.description.trim() || null,
          website: formData.website.trim() || null,
        });
        if (insertError) throw insertError;
      } else if (record) {
        const { error: updateError } = await civic
          .from('agencies')
          .update({
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            org_type: formData.org_type || null,
            parent_id: formData.parent_id.trim() || null,
            description: formData.description.trim() || null,
            website: formData.website.trim() || null,
          })
          .eq('id', record.id);
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

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-md w-full max-w-md max-h-[85vh] overflow-hidden shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            {isCreate ? 'New organization' : 'Organization'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-accent text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 overflow-y-auto space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-2">
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
          {canEdit ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <FormInput
                label="Name"
                value={formData.name}
                onChange={(v) => updateField('name', v)}
                required
              />
              <FormInput
                label="Slug"
                value={formData.slug}
                onChange={(v) => updateField('slug', v)}
                required
              />
              <FormSelect
                label="Type"
                value={formData.org_type}
                onChange={(v) => updateField('org_type', v)}
                options={isCreate ? [{ value: '', label: 'Select type' }, ...ORG_TYPES] : ORG_TYPES}
                required={!isCreate}
              />
              <FormInput
                label="Parent ID (UUID)"
                value={formData.parent_id}
                onChange={(v) => updateField('parent_id', v)}
              />
              <FormTextarea
                label="Description"
                value={formData.description}
                onChange={(v) => updateField('description', v)}
                rows={3}
              />
              <FormInput
                label="Website"
                value={formData.website}
                onChange={(v) => updateField('website', v)}
                type="url"
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
          ) : record ? (
            <>
              <div>
                <p className="text-xs font-medium text-foreground-muted mb-0.5">Name</p>
                <p className="text-sm text-foreground">{record.name}</p>
              </div>
              {record.slug && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Slug</p>
                  <p className="text-sm text-foreground">{record.slug}</p>
                </div>
              )}
              {record.org_type && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Type</p>
                  <p className="text-sm text-foreground">{record.org_type}</p>
                </div>
              )}
              {record.description && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Description</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{record.description}</p>
                </div>
              )}
              {record.website && (
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-0.5">Website</p>
                  <a
                    href={record.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground hover:underline break-all"
                  >
                    {record.website}
                  </a>
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
