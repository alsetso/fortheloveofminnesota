'use client';

import { useState } from 'react';
import OrgEditModal from './OrgEditModal';
import EditButton from '@/features/civic/components/EditButton';
import type { CivicOrg } from '@/features/civic/services/civicService';

interface OrgPageClientProps {
  org: CivicOrg;
  isAdmin: boolean;
}

/**
 * Client component for org page actions (edit button/modal).
 * Only renders edit functionality for admins.
 */
export default function OrgPageClient({ org, isAdmin }: OrgPageClientProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <EditButton onClick={() => setIsEditModalOpen(true)} label="Edit" />
      <OrgEditModal
        isOpen={isEditModalOpen}
        org={org}
        onClose={() => setIsEditModalOpen(false)}
        onSave={() => {
          setIsEditModalOpen(false);
          window.location.reload();
        }}
        isAdmin={isAdmin}
      />
    </>
  );
}
