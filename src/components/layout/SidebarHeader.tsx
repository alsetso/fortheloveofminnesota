'use client';

import { XMarkIcon, PencilIcon, ShareIcon, CheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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
  const handleShare = () => {
    if (onShare) {
      onShare();
    } else if (mapId) {
      const url = `${window.location.origin}/map/${mapId}`;
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Map link copied to clipboard', {
          duration: 3000,
        });
      }).catch(() => {
        toast.error('Failed to copy link', {
          duration: 4000,
        });
      });
    }
  };

  return (
    <div className="relative flex items-center px-2 py-1.5 border-b border-gray-200 flex-shrink-0">
      {/* Left: Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Edit/Save button */}
        {isOwner && onEdit && !isEditing && (
          <button
            onClick={onEdit}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
            aria-label="Edit"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
        )}
        {isEditing && onSave && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="p-1 text-gray-900 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center disabled:opacity-50"
            aria-label="Save"
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <CheckIcon className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {/* Share button */}
        {(onShare || mapId) && (
          <button
            onClick={handleShare}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
            aria-label="Share"
          >
            <ShareIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      
      {/* Center: Title - absolutely centered */}
      <h2 className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-900">{title}</h2>
      
      {/* Right: Close button */}
      <button
        onClick={onClose}
        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center flex-shrink-0 ml-auto"
        aria-label="Close"
      >
        <XMarkIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
