'use client';

import { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import AtlasTypeEditModal from './AtlasTypeEditModal';
import AtlasTypeCreateModal from './AtlasTypeCreateModal';

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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


  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-900">
          Atlas Types ({types.length})
        </h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
        >
          <PlusIcon className="w-3 h-3" />
          Create Type
        </button>
      </div>

      {/* Card Grid */}
      {types.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-200 p-[10px]">
          <p className="text-xs text-gray-600">No atlas types found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {types.map((type) => (
            <div
              key={type.id}
              className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors relative group"
            >
              {/* Icon and Name */}
              <div className="flex flex-col items-center text-center mb-2">
                {type.icon_path ? (
                  <div className="w-12 h-12 mb-2 flex items-center justify-center">
                    <Image
                      src={type.icon_path}
                      alt={type.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 mb-2 bg-gray-100 rounded-md flex items-center justify-center">
                    <span className="text-xs text-gray-400">No icon</span>
                  </div>
                )}
                <h3 className="text-xs font-semibold text-gray-900 mb-0.5">
                  {type.name}
                </h3>
                <p className="text-[10px] text-gray-500 font-mono">
                  {type.slug}
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex justify-center mb-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  type.status === 'active' ? 'bg-green-100 text-green-700' :
                  type.status === 'coming_soon' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {type.status.replace('_', ' ')}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(type)}
                  className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  title="Edit"
                >
                  <PencilIcon className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(type.id)}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AtlasTypeCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={fetchTypes}
      />

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

