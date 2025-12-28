'use client';

import { usePageView } from '@/hooks/usePageView';

interface AtlasRecordDetailClientProps {
  recordId: string;
  tableName: string;
}

export default function AtlasRecordDetailClient({
  recordId,
  tableName,
}: AtlasRecordDetailClientProps) {
  // Track page view (automatically uses current page URL)
  usePageView();

  return null;
}

