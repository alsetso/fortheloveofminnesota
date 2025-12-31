'use client';

import { PencilIcon } from '@heroicons/react/24/outline';

interface EditButtonProps {
  onClick: () => void;
  label?: string;
}

export default function EditButton({ onClick, label = 'Edit' }: EditButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50 transition-colors"
      title={`${label} record`}
    >
      <PencilIcon className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
}

