'use client';

import { useCallback, useMemo, useState } from 'react';
import { useWarmAccountSchools } from '@/features/discover/useWarmAccountSchools';
import { followSchool } from '@/lib/accountSchools/api';
import { useAccountSchoolRows } from '@/lib/accountSchools/store';

/** Account school store + add/save busy state for Discover schools surfaces. */
export function useAccountSchoolActions(accountId: string | null) {
  useWarmAccountSchools(accountId);
  const schools = useAccountSchoolRows();
  const addedSchoolIds = useMemo(
    () => new Set(schools.map((school) => school.school_id)),
    [schools],
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, work: () => Promise<void>) => {
      if (!accountId || busyKey) return;
      setBusyKey(key);
      setError(null);
      try {
        await work();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save.');
      } finally {
        setBusyKey(null);
      }
    },
    [accountId, busyKey],
  );

  const onAdd = useCallback(
    async (schoolId: string) => {
      if (!accountId || busyKey) return;
      setBusyKey(`add:${schoolId}`);
      setError(null);
      try {
        await followSchool(accountId, schoolId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not add school.');
      } finally {
        setBusyKey(null);
      }
    },
    [accountId, busyKey],
  );

  return {
    schools,
    addedSchoolIds,
    busyKey,
    error,
    run,
    onAdd,
  };
}
