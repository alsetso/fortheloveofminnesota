'use client';

import { useSyncExternalStore } from 'react';
import type { AccountSchool } from '@/lib/accountSchools/types';

let rows: AccountSchool[] = [];
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

export function getAccountSchools(): AccountSchool[] {
  return rows;
}

export function getAccountSchoolsAccountId(): string | null {
  return accountId;
}

export function setAccountSchools(nextAccountId: string, next: AccountSchool[]): void {
  accountId = nextAccountId;
  rows = next;
  emit();
}

export function upsertAccountSchool(row: AccountSchool): void {
  if (accountId && row.account_id !== accountId) return;
  if (!accountId) accountId = row.account_id;
  const idx = rows.findIndex((item) => item.id === row.id);
  rows = idx === -1 ? [...rows, row] : rows.map((item) => (item.id === row.id ? row : item));
  emit();
}

export function removeAccountSchool(id: string): void {
  const next = rows.filter((item) => item.id !== id);
  if (next.length === rows.length) return;
  rows = next;
  emit();
}

export function clearAccountSchools(): void {
  if (rows.length === 0 && accountId == null) return;
  rows = [];
  accountId = null;
  emit();
}

export function useAccountSchoolRows(): AccountSchool[] {
  return useSyncExternalStore(subscribe, getAccountSchools, () => rows);
}
