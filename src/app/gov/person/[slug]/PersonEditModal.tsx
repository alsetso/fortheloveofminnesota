'use client';

import { useState, type FormEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import { useFormState } from '@/hooks/useFormState';
import { updateCivicFieldsWithLogging } from '@/features/civic/utils/civicEditLogger';
import type { CivicPerson } from '@/features/civic/services/civicService';
import FormInput from '@/features/civic/components/FormInput';
import FormTextarea from '@/features/civic/components/FormTextarea';
import ImageUpload from '@/features/civic/components/ImageUpload';

interface PersonEditModalProps {
  isOpen: boolean;
  person: CivicPerson;
  onClose: () => void;
  onSave: () => void;
  isAdmin?: boolean;
}

export default function PersonEditModal({ isOpen, person, onClose, onSave, isAdmin = false }: PersonEditModalProps) {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const { formData, updateField } = useFormState({
    name: person.name,
    slug: person.slug || '',
    party: person.party || '',
    district: person.district || '',
    email: person.email || '',
    phone: person.phone || '',
    address: person.address || '',
    photo_url: person.photo_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
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
        const { error: updateError } = await (supabase
          .from('people') as any)
          .update({
            name: formData.name,
            slug: formData.slug || null,
            party: formData.party || null,
            district: formData.district || null,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            photo_url: formData.photo_url || null,
          })
          .eq('id', person.id);

        if (updateError) throw updateError;
      } else {
        // Community users can only edit editable fields - use logging
        const updates: Record<string, string | null> = {
          photo_url: formData.photo_url || null,
          party: formData.party || null,
          district: formData.district || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
        };

        const { error: updateError } = await updateCivicFieldsWithLogging(
          'people',
          person.id,
          updates,
          account.id,
          supabase
        );

        if (updateError) throw updateError;
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update person');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4 p-[10px] space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-900">Edit Person</h2>
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
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
              Photo
            </label>
            <ImageUpload
              currentUrl={formData.photo_url}
              pathPrefix={person.id}
              onUpload={(url) => updateField('photo_url', url)}
              size="md"
            />
          </div>

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
              />
            </>
          )}
          <FormInput
            label="Party"
            value={formData.party}
            onChange={(value) => updateField('party', value)}
          />
          <FormInput
            label="District"
            value={formData.district}
            onChange={(value) => updateField('district', value)}
          />
          <FormInput
            label="Email"
            value={formData.email}
            onChange={(value) => updateField('email', value)}
            type="email"
          />
          <FormInput
            label="Phone"
            value={formData.phone}
            onChange={(value) => updateField('phone', value)}
            type="tel"
          />
          <FormTextarea
            label="Address"
            value={formData.address}
            onChange={(value) => updateField('address', value)}
            rows={2}
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

