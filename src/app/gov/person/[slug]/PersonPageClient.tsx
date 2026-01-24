'use client';

import { useState } from 'react';
import PersonEditModal from './PersonEditModal';
import EditButton from '@/features/civic/components/EditButton';
import type { CivicPerson } from '@/features/civic/services/civicService';

interface PersonPageClientProps {
  person: CivicPerson;
  isAdmin: boolean;
}

/**
 * Client component for person page actions (edit button/modal).
 * Only renders edit functionality for admins.
 */
export default function PersonPageClient({ person, isAdmin }: PersonPageClientProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <EditButton onClick={() => setIsEditModalOpen(true)} label="Edit" />
      <PersonEditModal
        isOpen={isEditModalOpen}
        person={person}
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
