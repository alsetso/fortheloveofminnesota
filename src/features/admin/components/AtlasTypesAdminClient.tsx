'use client';

import { useState, useEffect, useRef } from 'react';
import { PencilIcon, TrashIcon, PhotoIcon } from '@heroicons/react/24/outline';
import AtlasTypeEditModal from './AtlasTypeEditModal';

interface AtlasType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_path: string | null;
  is_visible: boolean;
  status: 'active' | 'coming_soon' | 'unlisted';
  display_order: number;
  created_at: string;
  updated_at: string;
}

export default function AtlasTypesAdminClient() {
  const [types, setTypes] = useState<AtlasType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<AtlasType | null>(null);
  const [formData, setFormData] = useState<Partial<AtlasType>>({
    slug: '',
    name: '',
    description: '',
    icon_path: '',
    is_visible: true,
    status: 'active',
    display_order: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      const response = await fetch('/api/admin/atlas-types');
      if (!response.ok) throw new Error('Failed to fetch types');
      const data = await response.json();
      setTypes(data);
    } catch (error) {
      console.error('Error fetching types:', error);
      alert('Failed to load atlas types');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/admin/atlas-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }
      
      await fetchTypes();
      resetForm();
    } catch (error) {
      console.error('Error saving type:', error);
      alert(error instanceof Error ? error.message : 'Failed to save atlas type');
    }
  };

  const handleEdit = (type: AtlasType) => {
    setEditingType(type);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this atlas type?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/atlas-types/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete');
      
      await fetchTypes();
    } catch (error) {
      console.error('Error deleting type:', error);
      alert('Failed to delete atlas type');
    }
  };

  const resetForm = () => {
    setFormData({
      slug: '',
      name: '',
      description: '',
      icon_path: '',
      is_visible: true,
      status: 'active',
      display_order: 0,
    });
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/atlas-types/upload-icon', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      const data = await response.json();
      setFormData({ ...formData, icon_path: data.path });
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

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Left Column: Create Form */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">
          Create Atlas Type
        </h2>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">
              Slug *
            </label>
            <input
              type="text"
              required
              value={formData.slug || ''}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              placeholder="e.g., schools"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-0.5">
              Lowercase, alphanumeric, underscores only. Must match table name exactly.
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
              placeholder="e.g., Schools"
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
              Icon
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
              
              {formData.icon_path ? (
                <div className="flex items-center gap-2">
                  <img
                    src={formData.icon_path}
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
            {formData.icon_path && (
              <input
                type="text"
                value={formData.icon_path}
                onChange={(e) => setFormData({ ...formData, icon_path: e.target.value })}
                placeholder="Or enter icon URL manually"
                className="w-full mt-2 px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">
              Status *
            </label>
            <select
              required
              value={formData.status || 'active'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as AtlasType['status'] })}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
            >
              <option value="active">Active</option>
              <option value="coming_soon">Coming Soon</option>
              <option value="unlisted">Unlisted</option>
            </select>
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
              id="is_visible"
              checked={formData.is_visible ?? true}
              onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
              className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
            />
            <label htmlFor="is_visible" className="text-xs font-medium text-gray-700">
              Visible in listings
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={uploading}
              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>

      {/* Right Column: List */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">
          Atlas Types ({types.length})
        </h2>
        {types.length === 0 ? (
          <p className="text-xs text-gray-600">No atlas types found. Create one to get started.</p>
        ) : (
          <div className="space-y-1">
            {types.map((type) => (
              <div
                key={type.id}
                className="bg-gray-50 rounded-md border border-gray-200 p-[10px] hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {type.icon_path && (
                        <img
                          src={type.icon_path}
                          alt={type.name}
                          className="w-3 h-3 flex-shrink-0"
                        />
                      )}
                      <span className="text-xs font-semibold text-gray-900">{type.name}</span>
                      <span className="text-xs text-gray-500">({type.slug})</span>
                    </div>
                    {type.description && (
                      <p className="text-xs text-gray-600 mb-1">{type.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        type.status === 'active' ? 'bg-green-100 text-green-700' :
                        type.status === 'coming_soon' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {type.status}
                      </span>
                      {!type.is_visible && (
                        <span className="text-xs text-gray-500">Hidden</span>
                      )}
                      <span className="text-xs text-gray-500">Order: {type.display_order}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(type)}
                      className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(type.id)}
                      className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AtlasTypeEditModal
        isOpen={editingType !== null}
        type={editingType}
        onClose={() => setEditingType(null)}
        onSave={fetchTypes}
      />
    </div>
  );
}

