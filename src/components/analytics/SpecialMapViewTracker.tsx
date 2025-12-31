'use client';

import { useEffect, useRef } from 'react';
import { generateUUID } from '@/lib/utils/uuid';

interface SpecialMapViewTrackerProps {
  mapIdentifier: string;
}

export default function SpecialMapViewTracker({ mapIdentifier }: SpecialMapViewTrackerProps) {
  const hasRecordedRef = useRef(false);

  useEffect(() => {
    if (hasRecordedRef.current) return;
    hasRecordedRef.current = true;

    const recordView = async () => {
      try {
        // Get session ID from cookie or generate one
        let sessionId = document.cookie
          .split('; ')
          .find(row => row.startsWith('session_id='))
          ?.split('=')[1];

        if (!sessionId) {
          // Generate a UUID if not exists
          sessionId = generateUUID();
          document.cookie = `session_id=${sessionId}; path=/; max-age=31536000`; // 1 year
        }

        await fetch('/api/analytics/special-map-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            map_identifier: mapIdentifier,
            referrer_url: document.referrer || null,
            session_id: sessionId,
            user_agent: navigator.userAgent || null,
          }),
        });
      } catch (error) {
        console.error('Error recording special map view:', error);
      }
    };

    recordView();
  }, [mapIdentifier]);

  return null;
}

