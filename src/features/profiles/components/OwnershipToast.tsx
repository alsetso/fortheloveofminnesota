'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/features/ui/hooks/useToast';

interface OwnershipToastProps {
  isOwnProfile: boolean;
}

/**
 * Client component that displays an ownership toast when viewing your own profile.
 * Only shows once per page load to avoid spam.
 */
export default function OwnershipToast({ isOwnProfile }: OwnershipToastProps) {
  const { success } = useToast();
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (isOwnProfile && !hasShownRef.current) {
      hasShownRef.current = true;
      success('Your Profile', 'This is your profile');
    }
  }, [isOwnProfile, success]);

  return null;
}
