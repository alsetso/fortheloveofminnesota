'use client';

import { PencilIcon } from '@heroicons/react/24/outline';

interface EditableFieldBadgeProps {
  className?: string;
}

export default function EditableFieldBadge({ className = '' }: EditableFieldBadgeProps) {
  return (
    <span
      className={`inline-flex items-center ${className}`}
      title="Editable field"
    >
      <PencilIcon className="w-3 h-3 text-gray-400" />
    </span>
  );
}

