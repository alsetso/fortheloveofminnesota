'use client';

import { useState } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import Link from 'next/link';
import CreatePostModal from './CreatePostModal';
import ProfilePhoto from '../shared/ProfilePhoto';
import { Account } from '@/features/auth';

interface PostCreationFormProps {
  onPostCreated?: () => void;
}

export default function PostCreationForm({ onPostCreated }: PostCreationFormProps) {
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
      <div className="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3">
            {/* Profile Picture */}
            <Link href={`/profile/${account.username || account.id}`}>
              <ProfilePhoto 
                account={account as unknown as Account} 
                size="sm" 
                editable={false} 
              />
            </Link>

            {/* Input Field - FUNCTIONING */}
            <button
              type="button"
              onClick={() => openModal()}
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-left text-gray-500 hover:bg-gray-200 transition-colors"
            >
              What's on your mind, {accountName}?
            </button>
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onPostCreated={onPostCreated}
        initialAction={initialAction}
      />
    </>
  );
}
