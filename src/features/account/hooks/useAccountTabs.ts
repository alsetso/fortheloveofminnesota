'use client';

import { useState, useEffect } from 'react';
import type { AccountTabId } from '../types';

/**
 * Hook to manage account modal tab state
 */
export function useAccountTabs(initialTab?: AccountTabId, isOpen?: boolean) {
  const [activeTab, setActiveTab] = useState<AccountTabId>(initialTab || 'settings');

  // Update tab when initialTab changes
  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  return {
    activeTab,
    setActiveTab,
  };
}

