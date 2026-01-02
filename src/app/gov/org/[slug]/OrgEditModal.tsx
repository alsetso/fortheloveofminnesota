'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import { useFormState } from '@/hooks/useFormState';
import { updateCivicFieldsWithLogging } from '@/features/civic/utils/civicEditLogger';
import type { CivicOrg } from '@/features/civic/services/civicService';
import FormInput from '@/features/civic/components/FormInput';
import FormTextarea from '@/features/civic/components/FormTextarea';
import FormSelect from '@/features/civic/components/FormSelect';

interface OrgEditModalProps {
  isOpen: boolean;
  org: CivicOrg;
  onClose: () => void;
  onSave: () => void;
  isAdmin?: boolean;
}

export default function OrgEditModal({ isOpen, org, onClose, onSave, isAdmin = false }: OrgEditModalProps) {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const { formData, updateField } = useFormState({
    name: org.name,
    slug: org.slug,
    org_type: org.org_type,
    description: org.description || '',
    website: org.website || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.id) {
      setError('You must be signed in to edit');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isAdmin) {
        // Admin can edit all fields - direct update
        const { error: updateError } = await supabase
          .from('orgs')
          .update({
            name: formData.name,
            slug: formData.slug,
            org_type: formData.org_type,
            description: formData.description || null,
            website: formData.website || null,
          })
          .eq('id', org.id);

        if (updateError) throw updateError;
      } else {
        // Community users can only edit description and website - use logging
        const updates: Record<string, string | null> = {
          description: formData.description || null,
          website: formData.website || null,
        };

        const { error: updateError } = await updateCivicFieldsWithLogging(
          'orgs',
          org.id,
          updates,
          account.id,
          supabase
        );

        if (updateError) throw updateError;
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4 p-[10px] space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-900">Edit Organization</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded px-2 py-1">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          {isAdmin && (
            <>
              <FormInput
                label="Name"
                value={formData.name}
                onChange={(value) => updateField('name', value)}
                required
              />
              <FormInput
                label="Slug"
                value={formData.slug}
                onChange={(value) => updateField('slug', value)}
                required
              />
              <FormSelect
                label="Type"
                value={formData.org_type}
                onChange={(value) => updateField('org_type', value as any)}
                options={[
                  { value: 'branch', label: 'branch' },
                  { value: 'agency', label: 'agency' },
                  { value: 'department', label: 'department' },
                  { value: 'court', label: 'court' },
                ]}
                required
              />
            </>
          )}
          <FormTextarea
            label="Description"
            value={formData.description}
            onChange={(value) => updateField('description', value)}
            rows={3}
          />
          <FormInput
            label="Website"
            value={formData.website}
            onChange={(value) => updateField('website', value)}
            type="url"
          />

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-xs px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

