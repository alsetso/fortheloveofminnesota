import type { AccountPlace } from '@/lib/accountPlaces/types';

const KIND_ORDER: Record<AccountPlace['kind'], number> = {
  live_here: 1,
  work_here: 2,
  interested_in: 3,
};

export function alertsPlaceRole(row: AccountPlace): string {
  if (row.is_home) return 'Home';
  if (row.kind === 'live_here') return 'Live';
  if (row.kind === 'work_here') return 'Work';
  return 'Follow';
}

export function sortAlertPlaces(rows: AccountPlace[]): AccountPlace[] {
  return rows.slice().sort((a, b) => {
    if (a.is_home !== b.is_home) return a.is_home ? -1 : 1;
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
}
