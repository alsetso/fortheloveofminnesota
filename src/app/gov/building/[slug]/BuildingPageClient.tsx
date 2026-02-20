'use client';

import { useState } from 'react';
import EditButton from '@/features/civic/components/EditButton';
import { GovToastProvider } from '@/app/gov/contexts/GovToastContext';
import GovToast from '@/app/gov/components/GovToast';
import GovBuildingModal from '@/app/gov/components/GovBuildingModal';
import type { CivicBuilding } from '@/features/civic/services/civicService';

interface BuildingPageClientProps {
  building: CivicBuilding;
  isAdmin: boolean;
}

export default function BuildingPageClient({ building, isAdmin }: BuildingPageClientProps) {
  const [editOpen, setEditOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <GovToastProvider>
      <GovToast />
      <EditButton onClick={() => setEditOpen(true)} label="Edit" />
      {editOpen && (
        <GovBuildingModal
          record={{
            id: building.id,
            type: building.type,
            name: building.name,
            description: building.description,
            full_address: building.full_address,
            lat: building.lat,
            lng: building.lng,
            website: building.website,
            cover_images: building.cover_images,
          }}
          onClose={() => setEditOpen(false)}
          onSave={() => {
            setEditOpen(false);
            window.location.reload();
          }}
          isAdmin
        />
      )}
    </GovToastProvider>
  );
}
