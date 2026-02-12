'use client';

import { useAuthStateSafe } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface PostComposerProps {
  onPostCreated?: () => void;
  onOpenModal?: () => void;
}

/**
 * Post composer with Live video, Photo/video, and Feeling buttons
 */
export default function PostComposer({ onPostCreated, onOpenModal }: PostComposerProps) {
  const { account } = useAuthStateSafe();

  if (!account) {
    return null;
  }

  const handleInputClick = () => {
    onOpenModal?.();
  };

  return (
    <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3 mb-3">
      <div className="flex items-center gap-2">
        <ProfilePhoto account={account} size="sm" editable={false} />
        <button
          type="button"
          onClick={handleInputClick}
          className="flex-1 bg-surface-accent rounded-full px-4 py-2 text-sm text-left text-foreground-muted hover:bg-surface-accent/80 transition-colors border-none focus:outline-none"
        >
          What's on your mind, Minnesota?
        </button>
      </div>
    </div>
  );
}
