'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePageView } from '@/hooks/usePageView';
import PersonEditModal from './PersonEditModal';
import EditButton from '@/features/civic/components/EditButton';
import type { CivicPerson } from '@/features/civic/services/civicService';

interface PersonPageClientProps {
  person: CivicPerson;
  isAdmin: boolean;
}

export default function PersonPageClient({ person, isAdmin }: PersonPageClientProps) {
  const router = useRouter();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  usePageView();

  const handleSave = () => {
    router.refresh();
  };

  if (!isAdmin) return null;

  return (
    <>
      <EditButton onClick={() => setIsEditModalOpen(true)} />
      <PersonEditModal
        isOpen={isEditModalOpen}
        person={person}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
