'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePageView } from '@/hooks/usePageView';
import { useAuthStateSafe } from '@/features/auth';
import OrgEditModal from './OrgEditModal';
import EditButton from '@/features/civic/components/EditButton';
import type { CivicOrg } from '@/features/civic/services/civicService';

interface OrgPageClientProps {
  org: CivicOrg;
  isAdmin: boolean;
}

export default function OrgPageClient({ org, isAdmin }: OrgPageClientProps) {
  const router = useRouter();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  usePageView();

  const handleSave = () => {
    router.refresh();
  };

  const { account } = useAuthStateSafe();
  const isAuthenticated = !!account;
  
  if (!isAuthenticated && !isAdmin) return null;

  return (
    <>
      <EditButton onClick={() => setIsEditModalOpen(true)} />
      <OrgEditModal
        isOpen={isEditModalOpen}
        org={org}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSave}
        isAdmin={isAdmin}
      />
    </>
  );
}

