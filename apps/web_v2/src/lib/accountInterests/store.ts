'use client';

import { useSyncExternalStore } from 'react';
import type { Interest } from '@/lib/accountInterests/types';

let visible: Interest[] = [];
let selectedIds = new Set<string>();
let catalogIds = new Set<string>();
let catalogNames: string[] = [];
let accountId: string | null = null;
const listeners = new Set<() => void>();

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function refreshCatalog(): void {
  const nextIds = new Set<string>();
  const nextNames: string[] = [];
  for (const row of visible) {
    if (row.owner_account_id == null && selectedIds.has(row.id)) {
      nextIds.add(row.id);
      nextNames.push(row.name);
    }
  }
  if (!sameSet(catalogIds, nextIds)) catalogIds = nextIds;
  const namesSame =
    nextNames.length === catalogNames.length &&
    nextNames.every((name, index) => name === catalogNames[index]);
  if (!namesSame) catalogNames = nextNames;
}

function emit() {
  refreshCatalog();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVisibleInterests(): Interest[] {
  return visible;
}

export function getSelectedInterestIds(): Set<string> {
  return selectedIds;
}

export function getInterestsAccountId(): string | null {
  return accountId;
}

export function setVisibleInterests(next: Interest[]): void {
  visible = next;
  emit();
}

export function setSelectedInterestIds(
  nextAccountId: string,
  ids: Iterable<string>,
): void {
  accountId = nextAccountId;
  selectedIds = new Set(ids);
  emit();
}

export function upsertVisibleInterest(row: Interest): void {
  const idx = visible.findIndex((item) => item.id === row.id);
  visible =
    idx === -1 ? [...visible, row] : visible.map((item) => (item.id === row.id ? row : item));
  emit();
}

export function removeVisibleInterest(id: string): void {
  const next = visible.filter((item) => item.id !== id);
  if (next.length === visible.length) return;
  visible = next;
  if (selectedIds.has(id)) {
    const nextSelected = new Set(selectedIds);
    nextSelected.delete(id);
    selectedIds = nextSelected;
  }
  emit();
}

export function addSelectedInterestId(id: string): void {
  if (selectedIds.has(id)) return;
  const next = new Set(selectedIds);
  next.add(id);
  selectedIds = next;
  emit();
}

export function removeSelectedInterestId(id: string): void {
  if (!selectedIds.has(id)) return;
  const next = new Set(selectedIds);
  next.delete(id);
  selectedIds = next;
  emit();
}

export function clearAccountInterests(): void {
  resetInterestsForAccount(null);
}

/** Drop picks and custom rows before loading another account. Catalog stays. */
export function resetInterestsForAccount(nextAccountId: string | null): void {
  const nextVisible = visible.filter((row) => row.owner_account_id == null);
  const changed =
    nextAccountId !== accountId ||
    nextVisible.length !== visible.length ||
    selectedIds.size > 0;
  accountId = nextAccountId;
  selectedIds = new Set();
  visible = nextVisible;
  if (changed) emit();
}

export function useVisibleInterests(): Interest[] {
  return useSyncExternalStore(subscribe, getVisibleInterests, () => visible);
}

export function useSelectedInterestIds(): Set<string> {
  return useSyncExternalStore(subscribe, getSelectedInterestIds, () => selectedIds);
}

export function catalogSelectedIds(): Set<string> {
  return catalogIds;
}

export function useCatalogSelectedIds(): Set<string> {
  return useSyncExternalStore(subscribe, catalogSelectedIds, catalogSelectedIds);
}
