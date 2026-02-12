'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { PencilIcon, XMarkIcon, EyeIcon, EyeSlashIcon, TrashIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

type MentionType = { id: string; emoji: string; name: string; is_active?: boolean };

interface MentionTypeCardsProps {
  isAdmin?: boolean;
}

export default function MentionTypeCards({ isAdmin = false }: MentionTypeCardsProps) {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<MentionType | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false); // Start closed for admin accordions
  const [inactiveOpen, setInactiveOpen] = useState(false);

  const fetchMentionTypes = useCallback(async () => {
    try {
      let query = (supabase as any)
        .from('mention_types')
        .select('id, emoji, name, is_active')
        .order('name');
      if (!isAdmin) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (error) throw error;
      setMentionTypes((data || []) as MentionType[]);
    } catch (err) {
      console.error('Failed to fetch mention types:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, isAdmin]);

  useEffect(() => {
    fetchMentionTypes();
  }, [fetchMentionTypes]);

  const handleOpenEditModal = (type: MentionType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingType(type);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingType(null);
  };

  const handleSaveMentionType = async (emoji: string, name: string) => {
    if (!editingType) return;
    try {
      if (editingType.id) {
        const { error } = await (supabase as any)
          .from('mention_types')
          .update({ emoji, name })
          .eq('id', editingType.id);
        if (error) throw error;
        setMentionTypes((prev) =>
          prev.map((t) => (t.id === editingType.id ? { ...t, emoji, name } : t))
        );
      }
      handleCloseEditModal();
    } catch (err) {
      console.error('Failed to save mention type:', err);
      alert('Failed to save mention type');
    }
  };

  const handleToggleVisibility = async (type: MentionType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAdmin) return;
    try {
      const newIsActive = !(type.is_active ?? true);
      const { error } = await (supabase as any)
        .from('mention_types')
        .update({ is_active: newIsActive })
        .eq('id', type.id);
      if (error) throw error;
      setMentionTypes((prev) =>
        prev.map((t) => (t.id === type.id ? { ...t, is_active: newIsActive } : t))
      );
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
      alert('Failed to toggle visibility');
    }
  };

  const handleDeleteMentionType = async () => {
    if (!editingType?.id) return;
    if (!confirm('Are you sure you want to delete this mention type? This action cannot be undone.')) return;
    try {
      const { error } = await (supabase as any)
        .from('mention_types')
        .delete()
        .eq('id', editingType.id);
      if (error) throw error;
      setMentionTypes((prev) => prev.filter((t) => t.id !== editingType.id));
      handleCloseEditModal();
    } catch (err) {
      console.error('Failed to delete mention type:', err);
      alert('Failed to delete mention type');
    }
  };

  const goToLive = (type: MentionType, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('svg')) return;
    router.push(`/maps?type=${encodeURIComponent(mentionTypeNameToSlug(type.name))}`);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">What you can post</p>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-md p-[10px] h-12 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const activeTypes = mentionTypes.filter((t) => t.is_active !== false);
  const inactiveTypes = isAdmin ? mentionTypes.filter((t) => t.is_active === false) : [];

  if (activeTypes.length === 0 && inactiveTypes.length === 0) return null;

  const renderCard = (type: MentionType) => {
    const isActive = type.is_active !== false;
    return (
      <div
        key={type.id}
        role="button"
        tabIndex={0}
        onClick={(e) => goToLive(type, e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            router.push(`/maps?type=${encodeURIComponent(mentionTypeNameToSlug(type.name))}`);
          }
        }}
        className={`flex items-center gap-2 rounded-md border border-gray-200 p-[10px] transition-colors cursor-pointer group ${
          isActive ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 opacity-60'
        }`}
      >
        <span className="text-sm flex-shrink-0">{type.emoji}</span>
        <span className={`text-xs font-medium truncate flex-1 ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
          {type.name}
        </span>
        {isAdmin && (
          <span className="flex items-center gap-1 flex-shrink-0">
            {isActive ? (
              <EyeIcon
                onClick={(e) => handleToggleVisibility(type, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 text-gray-500 cursor-pointer hover:text-gray-700"
                title="Hide from public"
              />
            ) : (
              <EyeSlashIcon
                onClick={(e) => handleToggleVisibility(type, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 text-gray-500 cursor-pointer hover:text-gray-700"
                title="Show to public"
              />
            )}
            <PencilIcon
              onClick={(e) => handleOpenEditModal(type, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 text-gray-500 cursor-pointer hover:text-gray-700"
              title="Edit"
            />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">What you can post</p>
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide bg-gray-100 px-1.5 py-0.5 rounded">Admin</span>
      </div>
      {/* Active Types Accordion */}
      {activeTypes.length > 0 && (
        <div className="border border-gray-200 rounded-md bg-gray-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 p-[10px] text-left hover:bg-gray-100 transition-colors"
            aria-expanded={activeOpen}
          >
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Active</span>
            <span className="text-xs text-gray-500">{activeTypes.length}</span>
            <ChevronDownIcon
              className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${activeOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {activeOpen && (
            <div className="border-t border-gray-200 p-[10px] grid grid-cols-2 gap-2">
              {activeTypes.map(renderCard)}
            </div>
          )}
        </div>
      )}
      {isAdmin && inactiveTypes.length > 0 && (
        <div className="border border-gray-200 rounded-md bg-gray-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setInactiveOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 p-[10px] text-left hover:bg-gray-100 transition-colors"
            aria-expanded={inactiveOpen}
          >
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Inactive</span>
            <span className="text-xs text-gray-500">{inactiveTypes.length}</span>
            <ChevronDownIcon
              className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${inactiveOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {inactiveOpen && (
            <div className="border-t border-gray-200 p-[10px] grid grid-cols-2 gap-2">
              {inactiveTypes.map(renderCard)}
            </div>
          )}
        </div>
      )}

      {isEditModalOpen && editingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4 p-[10px] space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-900">Edit Mention Type</h2>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const emoji = formData.get('emoji') as string;
                const name = formData.get('name') as string;
                handleSaveMentionType(emoji, name);
              }}
              className="space-y-2"
            >
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Emoji</label>
                <input
                  type="text"
                  name="emoji"
                  defaultValue={editingType.emoji}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                  maxLength={2}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingType.name}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-2 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="flex-1 px-2 py-1.5 text-xs font-medium bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {editingType.id && (
                <button
                  type="button"
                  onClick={handleDeleteMentionType}
                  className="w-full px-2 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <TrashIcon className="w-3 h-3" />
                  Delete
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
