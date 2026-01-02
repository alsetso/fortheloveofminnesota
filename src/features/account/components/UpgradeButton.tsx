'use client';

import { useAppModalContextSafe } from '@/contexts/AppModalContext';

interface UpgradeButtonProps {
  feature?: string;
  className?: string;
  children: React.ReactNode;
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

