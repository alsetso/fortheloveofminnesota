'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage contribute overlay state based on URL hash
 * Consolidates hash detection, URL param handling, and overlay state
 */
export function useContributeOverlay() {
  const [showOverlay, setShowOverlay] = useState(false);

  // Check for #contribute hash and update state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkHash = () => {
      const hash = window.location.hash;
      setShowOverlay(hash === '#contribute');
    };

    // Initial check
    checkHash();

    // Listen for hash changes
    window.addEventListener('hashchange', checkHash);
    
    // Also listen for popstate for browser back/forward
    const handlePopState = () => {
      // Small delay to ensure hash is updated
      setTimeout(checkHash, 0);
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Open overlay with optional coordinates, mention type, and mapMeta
  const openOverlay = useCallback((coordinates?: { lat: number; lng: number }, mentionTypeId?: string, mapMeta?: Record<string, any> | null, fullAddress?: string | null) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    if (coordinates) {
      params.set('lat', coordinates.lat.toString());
      params.set('lng', coordinates.lng.toString());
    }
    if (mentionTypeId) {
      params.set('mention_type_id', mentionTypeId);
    }
    // Store mapMeta and fullAddress in sessionStorage to avoid URL length limits
    if (mapMeta || fullAddress) {
      const storageKey = `contribute_data_${Date.now()}`;
      sessionStorage.setItem(storageKey, JSON.stringify({ mapMeta, fullAddress }));
      params.set('data_key', storageKey);
    }

    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}#contribute`;
    window.history.pushState(null, '', newUrl);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);

  // Close overlay
  const closeOverlay = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Use history API to remove hash without page reload
    const url = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
    // Manually trigger hashchange to update state
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);

  return {
    showOverlay,
    openOverlay,
    closeOverlay,
  };
}
