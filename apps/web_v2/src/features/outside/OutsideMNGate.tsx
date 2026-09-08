'use client';

/**
 * OutsideMNGate — mounts invisibly inside /game (Map tab).
 *
 * On the first GPS fix this browser session, checks `isWithinMinnesota`.
 * If the user is outside MN → immediately replaces history with /outside
 * so the full game never renders for them.
 *
 * One session-storage flag (`ftlom_mn_checked`) prevents the redirect from
 * firing again if the user navigates back to /game from within the same
 * session (e.g. they used /outside → entered MN → tapped "Enter Game").
 *
 * No render output — this component is a pure side-effect controller.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isWithinMinnesota } from '@/map/location/device/minnesotaBounds';
import {
  getFindMeCoordsSnapshot,
  subscribeFindMeCoords,
} from '@/map/location/camera/findMeCoordsStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import { OUTSIDE_PATH } from '@/lib/routes/routePolicy';
import { OUTSIDE_MN_SESSION_KEY } from '@/features/outside/outsideSessionKey';

const SESSION_KEY = OUTSIDE_MN_SESSION_KEY;
// How long to wait for GPS before giving up and assuming the user is in MN.
const GPS_TIMEOUT_MS = 8_000;

export function OutsideMNGate() {
  const router = useRouter();

  useEffect(() => {
    // Already resolved this session — skip.
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1') {
      return;
    }

    let cancelled = false;

    function markChecked() {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, '1');
      }
    }

    function evaluate(lat: number, lng: number) {
      if (cancelled) return;
      markChecked();
      if (!isWithinMinnesota({ lat, lng })) {
        router.replace(OUTSIDE_PATH);
      }
    }

    // Try an existing fix first — find_me step may have already resolved.
    const snap = getFindMeCoordsSnapshot();
    const existing = snap.coords ?? snap.lookupCoords ?? getFindMeLastCoords();
    if (existing) {
      evaluate(existing.lat, existing.lng);
      return () => { cancelled = true; };
    }

    // No fix yet — subscribe and wait up to GPS_TIMEOUT_MS.
    const unsub = subscribeFindMeCoords(() => {
      const s = getFindMeCoordsSnapshot();
      const fix = s.coords ?? s.lookupCoords ?? getFindMeLastCoords();
      if (fix) {
        clearTimeout(timer);
        unsub();
        evaluate(fix.lat, fix.lng);
      }
    });

    // Timeout — GPS too slow or denied; assume in MN, mark checked, and proceed.
    const timer = setTimeout(() => {
      if (!cancelled) { unsub(); markChecked(); }
    }, GPS_TIMEOUT_MS);

    return () => {
      cancelled = true;
      unsub();
      clearTimeout(timer);
    };
  }, [router]);

  return null;
}
