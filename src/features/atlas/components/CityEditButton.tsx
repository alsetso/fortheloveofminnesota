'use client';

import { useState } from 'react';
import { PencilIcon } from '@heroicons/react/24/outline';
import { City } from '@/features/admin/services/cityAdminService';
import CityEditModal from './CityEditModal';

interface CityEditButtonProps {
  city: City;
  isAdmin: boolean;
}

export default function CityEditButton({ city, isAdmin }: CityEditButtonProps) {
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
        title="Edit City"
      >
        <PencilIcon className="w-3 h-3" />
        Edit
      </button>
      <CityEditModal
        isOpen={isModalOpen}
        city={city}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}

// Re-export modal for direct use if needed
export { CityEditModal };







