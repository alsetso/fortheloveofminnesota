'use client';

import { useEffect } from 'react';

/**
 * Cleans up old localStorage data and oversized cookies that might cause 431 errors
 * Runs once on mount to clear legacy data
 */
export default function LocalStorageCleanup() {
  useEffect(() => {
    // Clear old freemap localStorage keys that might be large
    try {
      const keysToRemove = [
        'freemap_sessions',
        'freemap_current_session',
        'freemap_api_usage',
      ];
      
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          console.log(`Clearing localStorage key: ${key}`);
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }

    // Clear oversized cookies that might cause 431 errors
    try {
      const cookies = document.cookie.split(';');
      let totalCookieSize = 0;
      const cookiesToCheck: string[] = [];

      cookies.forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name) {
          cookiesToCheck.push(name);
          const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith(name + '='));
          if (cookieValue) {
            totalCookieSize += cookieValue.length;
          }
        }
      });

      // If total cookie size exceeds 8KB, clear non-essential cookies
      // Supabase auth cookies (sb-*) should be kept, but clear others
      if (totalCookieSize > 8192) {
        console.warn(`Total cookie size (${totalCookieSize} bytes) exceeds 8KB, clearing non-essential cookies`);
        
        cookiesToCheck.forEach(cookieName => {
          // Keep Supabase auth cookies (sb-*)
          if (!cookieName.startsWith('sb-') && !cookieName.startsWith('supabase.')) {
            // Clear cookie by setting it to expire in the past
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
            console.log(`Cleared cookie: ${cookieName}`);
          }
        });
      }
    } catch (error) {
      console.error('Error clearing cookies:', error);
    }
  }, []);

  return null;
}

