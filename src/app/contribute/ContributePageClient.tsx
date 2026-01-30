'use client';

import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import ContributeOverlay from '@/app/map/[id]/components/ContributeOverlay';

interface ContributePageClientProps {
  mapId: string;
  mapSlug: string;
}

export default function ContributePageClient({ mapId, mapSlug }: ContributePageClientProps) {
  const router = useRouter();

  const handleClose = () => {
    // Navigate back or to home
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleMentionCreated = () => {
    // After creating mention, redirect to live map to see it
    router.push('/live');
  };

  return (
    <ContributeOverlay
      isOpen={true}
      onClose={handleClose}
      mapId={mapId}
      mapSlug={mapSlug}
      onMentionCreated={handleMentionCreated}
    />
  );
}
