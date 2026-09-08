'use client';

/**
 * useSnapZoom — REMOVED.
 *
 * The Locked → Explore escape on pinch-out has been eliminated.
 * The game surface runs in follow (Locked) mode permanently; zoom gestures
 * simply zoom around the user's position and are clamped at MIN_ZOOM.
 * No code path ever calls setMapMode('scout') from a gesture.
 */

export function useSnapZoom(_map: unknown, _enabled: unknown): void {}
