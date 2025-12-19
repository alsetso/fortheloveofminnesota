'use client';

import { useState } from 'react';
import { PencilIcon } from '@heroicons/react/24/outline';
import { County } from '@/features/admin/services/countyAdminService';
import CountyEditModal from './CountyEditModal';

interface CountyEditButtonProps {
  county: County;
  isAdmin: boolean;
}

export default function CountyEditButton({ county, isAdmin }: CountyEditButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!isAdmin) return null;

  const handleSave = () => {
    // Refresh the page to show updated data
    window.location.reload();
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        title="Edit County"
      >
        <PencilIcon className="w-3 h-3" />
        Edit
      </button>
      <CountyEditModal
        isOpen={isModalOpen}
        county={county}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}






