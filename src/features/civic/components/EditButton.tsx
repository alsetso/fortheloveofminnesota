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
      className="flex items-center gap-1.5 px-2 py-1 border border-border rounded text-xs text-foreground-muted hover:text-foreground hover:bg-surface-accent dark:hover:bg-white/10 transition-colors"
      title={`${label} record`}
    >
      <PencilIcon className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
}

