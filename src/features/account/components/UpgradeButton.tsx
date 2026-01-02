'use client';

import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { ReactNode } from 'react';

interface UpgradeButtonProps {
  feature?: string;
  className?: string;
  children: ReactNode;
}

export default function UpgradeButton({ feature, className, children }: UpgradeButtonProps) {
  const { openUpgrade } = useAppModalContextSafe();

  return (
    <button
      onClick={() => openUpgrade(feature)}
      className={className}
    >
      {children}
    </button>
  );
}

