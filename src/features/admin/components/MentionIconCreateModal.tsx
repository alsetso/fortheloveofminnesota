'use client';

import { useState, useRef } from 'react';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface MentionIcon {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_url: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface MentionIconCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function MentionIconCreateModal({
  isOpen,
  onClose,
  onSave,
}: MentionIconCreateModalProps) {
  const [formData, setFormData] = useState<Partial<MentionIcon>>({
    slug: '',
    name: '',
    description: '',
    icon_url: '',
    is_active: true,
    display_order: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    try {
      const response = await fetch('/api/admin/mention-icons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create');
      }

      onSave();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating icon:', error);
      alert(error instanceof Error ? error.message : 'Failed to create mention icon');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      slug: '',
      name: '',
      description: '',
      icon_url: '',
      is_active: true,
      display_order: 0,
    });
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/admin/mention-icons/upload-icon', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      const data = await response.json();
      setFormData((prev) => ({ ...prev, icon_url: data.path }));
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload icon');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formattedSlug = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setFormData((prev) => ({ ...prev, slug: formattedSlug }));
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
        <div
          className="bg-white rounded-md border border-gray-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-[10px] py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Create Mention Icon</h2>
            <button
              onClick={handleClose}
              disabled={saving}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-[10px] space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Slug *
              </label>
              <input
                type="text"
                required
                value={formData.slug || ''}
                onChange={handleSlugChange}
                placeholder="e.g., heart"
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                Lowercase, alphanumeric, underscores only.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Heart"
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Icon *
              </label>
              
              {/* Upload Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-md p-3 cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-gray-400 bg-gray-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                  onChange={handleFileInput}
                  className="hidden"
                />
                
                {formData.icon_url ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={formData.icon_url}
                      alt="Icon preview"
                      className="w-8 h-8 object-contain"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        Icon uploaded
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Click to replace
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <PhotoIcon className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        {uploading ? 'Uploading...' : 'Drag & drop or click to upload'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        PNG, JPEG, GIF, WebP, SVG (max 5MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Manual URL input (optional) */}
              {formData.icon_url && (
                <input
                  type="text"
                  value={formData.icon_url}
                  onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                  placeholder="Or enter icon URL manually"
                  className="w-full mt-2 px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order || 0}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active ?? true}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
              />
              <label htmlFor="is_active" className="text-xs font-medium text-gray-700">
                Active (show in icon selector)
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading || !formData.icon_url}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

