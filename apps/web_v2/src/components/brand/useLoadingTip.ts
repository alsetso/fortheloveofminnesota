'use client';

import { useEffect, useState } from 'react';
import {
  LOADING_TIPS,
  pickRandomLoadingTip,
  type LoadingTip,
} from '@/components/brand/loadingTips';

/**
 * Stable tip for SSR + first client paint, then a random tip after mount.
 * Avoids hydration mismatch from Math.random() in useState initializers.
 */
export function useLoadingTip(): LoadingTip {
  const [tip, setTip] = useState<LoadingTip>(() => LOADING_TIPS[0]);
  useEffect(() => {
    setTip(pickRandomLoadingTip());
  }, []);
  return tip;
}
