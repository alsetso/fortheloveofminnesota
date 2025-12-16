'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useProfile } from '@/features/profiles/contexts/ProfileContext';
import { useToast } from '@/features/ui/hooks/useToast';
import { AreaService, CreateAreaData } from '@/features/areas/services/areaService';

interface InlineAreaSaveFormProps {
  geometry: GeoJSON.Geometry;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

export function InlineAreaSaveForm({
  geometry,
  onSave,
  onCancel,
}: InlineAreaSaveFormProps) {
  const { selectedProfile } = useProfile();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [category, setCategory] = useState<'custom' | 'county' | 'city' | 'state' | 'region' | 'zipcode'>('custom');
  const [isSaving, setIsSaving] = useState(false);
  const { success, error } = useToast();

  const handleSave = async () => {
    if (!name.trim()) {
      error('Name Required', 'Please enter a name for your area');
      return;
    }

    if (!selectedProfile) {
      error('Profile Required', 'Please select a profile to save this area');
      return;
    }

    setIsSaving(true);
    try {
      const data: CreateAreaData = {
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        category,
        geometry,
      };

      await AreaService.createArea(data, selectedProfile.id);
      success('Area Saved', 'Your area has been saved successfully');
      await onSave();
    } catch (err) {
      console.error('Error saving area:', err);
      error('Save Failed', err instanceof Error ? err.message : 'Failed to save area');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[100] w-full max-w-sm pointer-events-auto">
      <div className="bg-black/95 backdrop-blur-md rounded-2xl border border-header-focus shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-header-focus">
          <h3 className="text-sm font-semibold text-gray-100">Save Area</h3>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 rounded transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {/* Name */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Area name *"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50"
              disabled={isSaving}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50 resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50"
              disabled={isSaving}
            >
              <option value="custom" className="bg-black text-white">Custom</option>
              <option value="county" className="bg-black text-white">County</option>
              <option value="city" className="bg-black text-white">City</option>
              <option value="state" className="bg-black text-white">State</option>
              <option value="region" className="bg-black text-white">Region</option>
              <option value="zipcode" className="bg-black text-white">Zipcode</option>
            </select>
          </div>

          {/* Visibility */}
          <div>
            <div className="flex gap-2">
              <button
                onClick={() => setVisibility('public')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  visibility === 'public'
                    ? 'bg-gold-500/80 text-black'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
                disabled={isSaving}
              >
                Public
              </button>
              <button
                onClick={() => setVisibility('private')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  visibility === 'private'
                    ? 'bg-gold-500/80 text-black'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
                disabled={isSaving}
              >
                Private
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className="flex-1 px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? 'Saving...' : 'Save'}
              {!isSaving && <CheckIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


