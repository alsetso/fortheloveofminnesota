'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Area, UpdateAreaData } from '@/features/areas/services/areaService';
import { useToast } from '@/features/ui/hooks/useToast';

interface InlineAreaEditFormProps {
  area: Area;
  onSave: (areaId: string, data: UpdateAreaData) => Promise<void>;
  onDelete: (areaId: string) => Promise<void>;
  onEditShape: (area: Area) => void;
  onCancel: () => void;
}

export function InlineAreaEditForm({
  area,
  onSave,
  onDelete,
  onEditShape,
  onCancel,
}: InlineAreaEditFormProps) {
  const [name, setName] = useState(area.name);
  const [description, setDescription] = useState(area.description || '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(area.visibility);
  const [category, setCategory] = useState<'custom' | 'county' | 'city' | 'state' | 'region' | 'zipcode'>(area.category || 'custom');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    setName(area.name);
    setDescription(area.description || '');
    setVisibility(area.visibility);
    setCategory(area.category || 'custom');
  }, [area]);

  const handleSave = async () => {
    if (!name.trim()) {
      error('Name Required', 'Please enter a name for your area');
      return;
    }

    setIsSaving(true);
    try {
      const data: UpdateAreaData = {
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        category,
      };

      await onSave(area.id, data);
      success('Area Updated', 'Your area has been updated successfully');
    } catch (err) {
      console.error('Error updating area:', err);
      error('Update Failed', err instanceof Error ? err.message : 'Failed to update area');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this area?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(area.id);
      success('Area Deleted', 'Your area has been deleted');
    } catch (err) {
      error('Delete Failed', err instanceof Error ? err.message : 'Failed to delete area');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[100] w-full max-w-sm pointer-events-auto">
      <div className="bg-black/95 backdrop-blur-md rounded-2xl border border-header-focus shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-header-focus">
          <h3 className="text-sm font-semibold text-gray-100">Edit Area</h3>
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
              disabled={isSaving || isDeleting}
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
              disabled={isSaving || isDeleting}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50"
              disabled={isSaving || isDeleting}
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
                disabled={isSaving || isDeleting}
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
                disabled={isSaving || isDeleting}
              >
                Private
              </button>
            </div>
          </div>

          {/* Edit Shape Button */}
          <button
            onClick={() => onEditShape(area)}
            disabled={isSaving || isDeleting}
            className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Edit Shape
          </button>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={onCancel}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || isSaving || isDeleting}
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


