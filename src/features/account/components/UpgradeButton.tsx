'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

interface UpgradeButtonProps {
  feature?: string;
  className?: string;
  children: ReactNode;
}

export default function UpgradeButton({ feature, className, children }: UpgradeButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push('/billing')}
      className={className}
    >
      {children}
    </button>
  );
}

