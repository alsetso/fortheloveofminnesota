/**
 * Session storage utilities for map data log
 * Stores pins and areas created during a map session
 */

import type { MapFeature } from '../types/featureCollection';

const DATA_LOG_KEY = 'map-page-data-log';

export interface DataLogEntry {
  id: string;
  feature: MapFeature;
  timestamp: number;
  label?: string;
}

/**
 * Get all entries from data log
 */
export function getDataLogEntries(): DataLogEntry[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = sessionStorage.getItem(DATA_LOG_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to read data log:', error);
    return [];
  }
}

/**
 * Add an entry to the data log
 */
export function addDataLogEntry(feature: MapFeature, label?: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const entries = getDataLogEntries();
    const newEntry: DataLogEntry = {
      id: feature.id,
      feature,
      timestamp: Date.now(),
      label,
    };
    
    entries.push(newEntry);
    sessionStorage.setItem(DATA_LOG_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save to data log:', error);
  }
}

/**
 * Remove an entry from the data log
 */
export function removeDataLogEntry(entryId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const entries = getDataLogEntries();
    const filtered = entries.filter(e => e.id !== entryId);
    sessionStorage.setItem(DATA_LOG_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove from data log:', error);
  }
}

/**
 * Clear all entries from the data log
 */
export function clearDataLog(): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.removeItem(DATA_LOG_KEY);
  } catch (error) {
    console.error('Failed to clear data log:', error);
  }
}

/**
 * Get count of entries in data log
 */
export function getDataLogCount(): number {
  return getDataLogEntries().length;
}

