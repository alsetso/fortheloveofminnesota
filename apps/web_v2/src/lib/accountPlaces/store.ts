'use client';

import { useSyncExternalStore } from 'react';
import type { AccountPlace } from '@/lib/accountPlaces/types';

let rows: AccountPlace[] = [];
let accountId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAccountPlaces(): AccountPlace[] {
  return rows;
}

export function getAccountPlacesAccountId(): string | null {
  return accountId;
}

export function setAccountPlaces(nextAccountId: string, next: AccountPlace[]): void {
  accountId = nextAccountId;
  rows = next;
  emit();
}

export function upsertAccountPlace(row: AccountPlace): void {
  if (accountId && row.account_id !== accountId) return;
  if (!accountId) accountId = row.account_id;
  const idx = rows.findIndex((item) => item.id === row.id);
  rows = idx === -1 ? [...rows, row] : rows.map((item) => (item.id === row.id ? row : item));
  emit();
}

export function removeAccountPlace(id: string): void {
  const next = rows.filter((item) => item.id !== id);
  if (next.length === rows.length) return;
  rows = next;
  emit();
}

export function clearAccountPlaces(): void {
  if (rows.length === 0 && accountId == null) return;
  rows = [];
  accountId = null;
  emit();
}

/** Alert-style account_places rows (notify / home). Distinct from auth dock affinities. */
export function useAccountPlaceRows(): AccountPlace[] {
  return useSyncExternalStore(subscribe, getAccountPlaces, () => rows);
}
