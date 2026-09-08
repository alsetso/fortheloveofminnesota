'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSafe } from '@/features/auth';
import PolicyUpdateModal from '@/components/legal/PolicyUpdateModal';
import type { NeedsReconsentResponse, PolicyUpdateInfo } from '@/app/api/legal/needs-reconsent/route';

/**
 * PolicyUpdateGate
 *
 * Checks once per authenticated session whether the account's accepted policy
 * versions are behind the current published versions. If so, surfaces a
 * full-screen reconsent modal that cannot be dismissed without explicit agreement.
 *
 * Logic:
 *  - Only runs when user + account are both resolved (never during splash/boot)
 *  - Checks once per account per session (sessionStorage flag)
 *  - On agreement, calls /api/legal/accept with method: 'reconsent'
 *  - Clears the flag so a subsequent mount re-checks (handles publish during session)
 */
export default function PolicyUpdateGate() {
  const { user, account } = useAuthSafe();
  const [updates, setUpdates] = useState<PolicyUpdateInfo[] | null>(null);
  const checkInFlight = useRef(false);

  useEffect(() => {
    if (!user?.id || !account?.id) return;

    const flagKey = `ftlomn_policy_check:${account.id}`;
    if (sessionStorage.getItem(flagKey) === '1') return;
    if (checkInFlight.current) return;
    checkInFlight.current = true;

    void fetch('/api/legal/needs-reconsent', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as NeedsReconsentResponse;
        if (data.needs_reconsent) {
          setUpdates(data.updates);
        } else {
          sessionStorage.setItem(flagKey, '1');
        }
      })
      .catch(() => {/* non-blocking */})
      .finally(() => {
        checkInFlight.current = false;
      });
  }, [user?.id, account?.id]);

  const handleAccept = useCallback(async () => {
    const res = await fetch('/api/legal/accept', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'reconsent', platform: 'ios2' }),
    });
    if (!res.ok) throw new Error('Failed to record acceptance');
    if (account?.id) {
      sessionStorage.setItem(`ftlomn_policy_check:${account.id}`, '1');
      sessionStorage.setItem(`ftlomn_legal_accept_ok:${account.id}`, '1');
    }
    setUpdates(null);
  }, [account?.id]);

  if (!updates) return null;

  return <PolicyUpdateModal updates={updates} onAccept={handleAccept} />;
}
