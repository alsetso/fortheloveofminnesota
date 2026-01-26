'use client';

import { useState, useRef, useEffect } from 'react';
import { EllipsisVerticalIcon, XMarkIcon, PencilIcon, TrashIcon, ShareIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';

interface SidebarHeaderProps {
  title: string;
  onClose: () => void;
  isOwner?: boolean;
  mapId?: string;
  mapName?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  showMenu?: boolean;
  isEditing?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
}

export default function SidebarHeader({
  title,
  onClose,
  isOwner = false,
  mapId,
  mapName,
  onEdit,
  onDelete,
  onShare,
  showMenu = true,
  isEditing = false,
  isSaving = false,
  onSave,
  onCancel,
}: SidebarHeaderProps) {
  const router = useRouter();
  const { addToast } = useToastContext();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Keep dropdown open when editing, close when not editing
  useEffect(() => {
    if (isEditing) {
      setShowDropdown(true);
    } else {
      // Close dropdown when editing ends (after save or cancel)
      setShowDropdown(false);
    }
  }, [isEditing]);

  // Close dropdown when clicking outside (but not when editing)
  useEffect(() => {
    if (!showDropdown || isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, isEditing]);

  const handleDelete = async () => {
    if (!mapId || !confirm(`Are you sure you want to delete "${mapName || 'this map'}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete map');
      }

      addToast(createToast('success', 'Map deleted successfully', {
        duration: 3000,
      }));
      router.push('/maps');
    } catch (err: any) {
      addToast(createToast('error', err.message || 'Failed to delete map', {
        duration: 4000,
      }));
    } finally {
      setShowDropdown(false);
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
    } else if (mapId) {
      const url = `${window.location.origin}/map/${mapId}`;
      navigator.clipboard.writeText(url).then(() => {
        addToast(createToast('success', 'Map link copied to clipboard', {
          duration: 3000,
        }));
      }).catch(() => {
        addToast(createToast('error', 'Failed to copy link', {
          duration: 4000,
        }));
      });
    }
    setShowDropdown(false);
  };

  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <div className="flex items-center gap-1">
        {showMenu && (
          <div className="relative">
            <button
              ref={menuButtonRef}
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Menu"
            >
              <EllipsisVerticalIcon className="w-4 h-4" />
            </button>
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-md shadow-lg min-w-[160px]"
              >
                <div className="py-1">
                  <button
                    onClick={() => {
                      if (isEditing && onCancel) {
                        onCancel();
                        setShowDropdown(false);
                      } else {
                        onClose();
                        setShowDropdown(false);
                      }
                    }}
                    disabled={isSaving}
                    className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                    {isEditing ? 'Cancel' : 'Close'}
                  </button>
                  {isOwner && onEdit && !isEditing && (
                    <button
                      onClick={() => {
                        onEdit();
                        setShowDropdown(true); // Keep open when entering edit mode
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <PencilIcon className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                  {isEditing && onCancel && (
                    <button
                      onClick={() => {
                        onCancel();
                        setShowDropdown(false);
                      }}
                      disabled={isSaving}
                      className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  )}
                  {isEditing && onSave && (
                    <button
                      onClick={() => {
                        onSave();
                        // Don't close dropdown here - let it close after save completes
                      }}
                      disabled={isSaving}
                      className="w-full px-3 py-1.5 text-left text-xs text-gray-900 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 font-medium"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="w-3.5 h-3.5" />
                          Save
                        </>
                      )}
                    </button>
                  )}
                  {isOwner && (onDelete || mapId) && (
                    <button
                      onClick={handleDelete}
                      className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                  {(onShare || mapId) && (
                    <button
                      onClick={handleShare}
                      className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <ShareIcon className="w-3.5 h-3.5" />
                      Share
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
