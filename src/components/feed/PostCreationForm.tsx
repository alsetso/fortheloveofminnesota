'use client';

import { useState } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import CreatePostModal from './CreatePostModal';

interface PostCreationFormProps {
  onPostCreated?: () => void;
  mapId?: string | null;
}

export default function PostCreationForm({ onPostCreated, mapId }: PostCreationFormProps) {
  const { account } = useAuthStateSafe();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialAction, setInitialAction] = useState<'upload_photo' | 'upload_video' | 'mention' | null>(null);

  const accountName = account?.first_name || account?.username || 'User';

  if (!account) {
    return null;
  }

  const openModal = (action: 'upload_photo' | 'upload_video' | 'mention' | null = null) => {
    setInitialAction(action);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setInitialAction(null);
  };

  return (
    <>
      {/* Input Field Only */}
      <button
        type="button"
        onClick={() => openModal()}
        className="w-full bg-gray-100 rounded-full px-4 py-2.5 text-left text-gray-500 hover:bg-gray-200 transition-colors"
      >
        What's on your mind, {accountName}?
      </button>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onPostCreated={onPostCreated}
        initialAction={initialAction}
        initialMapId={mapId}
      />
    </>
  );
}
