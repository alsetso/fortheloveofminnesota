'use client';

import { useState, useEffect } from 'react';
import { useAuth, AccountService, Account } from '@/features/auth';
import PostCreationTrigger from './PostCreationTrigger';
import PostPublisherModal from '@/features/feed/components/PostPublisherModal';
import MediaUploadEditor from '@/features/feed/components/MediaUploadEditor';
import PostMapModal, { PostMapData } from '@/features/feed/components/PostMapModal';

// Allow partial account data for flexibility
type PartialAccount = Partial<Account> & {
  id: string;
  image_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

interface PostCreationCardProps {
  onPostCreated?: () => void;
  account?: PartialAccount | Account | null;
  showActions?: boolean;
  className?: string;
}

export default function PostCreationCard({ 
  onPostCreated, 
  account: providedAccount,
  showActions = true,
  className = '',
}: PostCreationCardProps) {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(providedAccount && 'user_id' in providedAccount && providedAccount.user_id !== undefined ? providedAccount as Account : null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [postModalMode, setPostModalMode] = useState<'default'>('default');
  const [pendingMedia, setPendingMedia] = useState<Array<{ url: string; filename: string; type: string; thumbnail_url?: string }>>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<Array<{ url: string; file: File; type: string }>>([]);
  const [pendingMapData, setPendingMapData] = useState<PostMapData | null>(null);

  // Load account data if not provided
  useEffect(() => {
    if (user && !providedAccount) {
      AccountService.getCurrentAccount()
        .then(setAccount)
        .catch((err) => {
          console.error('Error loading account:', err);
        });
    } else if (providedAccount) {
      // Convert partial account to full Account if needed
      // For PostPublisherModal, we only need id, image_url, first_name, last_name
      setAccount(providedAccount as Account);
    }
  }, [user, providedAccount]);

  const handleInputClick = () => {
    setPostModalMode('default');
    setShowPostModal(true);
  };

  const handleMediaClick = () => {
    setShowMediaEditor(true);
  };

  const handleMapClick = () => {
    setShowMapModal(true);
  };

  const resetState = () => {
    setShowPostModal(false);
    setPostModalMode('default');
    setPendingMedia([]);
    setPendingFiles([]);
    setPendingPreviews([]);
    setPendingMapData(null);
  };

  if (!user) return null;

  return (
    <>
      <PostCreationTrigger
        account={account}
        onTextClick={handleInputClick}
        onMediaClick={handleMediaClick}
        onMapClick={handleMapClick}
        showActions={showActions}
        className={className}
      />

      {/* Media Upload Editor */}
      {showMediaEditor && (
        <MediaUploadEditor
          isOpen={showMediaEditor}
          onClose={() => {
            setShowMediaEditor(false);
          }}
          account={account}
          onUploadComplete={onPostCreated}
          initialFiles={pendingFiles}
          initialPreviews={pendingPreviews}
          onMediaReady={(media, files) => {
            setPendingMedia(media);
            setPendingFiles(files);
            const previews = media.map((m, idx) => ({
              url: m.url,
              file: files[idx],
              type: m.type,
            }));
            setPendingPreviews(previews);
            setShowMediaEditor(false);
            setShowPostModal(true);
          }}
        />
      )}

      {/* Map Modal */}
      {showMapModal && (
        <PostMapModal
          isOpen={showMapModal}
          onClose={() => {
            setShowMapModal(false);
          }}
          initialMapData={pendingMapData}
          onSave={(mapData) => {
            setPendingMapData(mapData);
            setShowMapModal(false);
            setShowPostModal(true);
          }}
        />
      )}

      {/* Post Publisher Modal */}
      {showPostModal && (
        <PostPublisherModal
          isOpen={showPostModal}
          onClose={resetState}
          initialFiles={pendingFiles}
          account={account}
          onPostCreated={onPostCreated}
          initialMedia={pendingMedia}
          initialMapData={pendingMapData}
          onBackToMedia={
            pendingMedia.length > 0
              ? () => {
                  setShowPostModal(false);
                  setShowMediaEditor(true);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
