'use client';

import type { ReactNode } from 'react';
import AppShell from '@/features/appShell/AppShell';

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
