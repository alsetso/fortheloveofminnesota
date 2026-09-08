/**
 * Compose-pane header store.
 *
 * Lets `DockPostComposePane` project its submit / visibility state up into
 * `MapDockPill` without prop-drilling through the dock shell.
 *
 * Pattern mirrors `selectedPinModeStore` — plain pub-sub, no React outside
 * the hook so non-React callers (e.g. imperative map code) can read it too.
 */

import { useEffect, useState } from 'react';

export type ComposeVisibility = 'public' | 'only_me';

export type ComposeHeaderState = {
  /** True while a post-compose pane is mounted. */
  active: boolean;
  /** Whether the Post button should be enabled. */
  canPost: boolean;
  /** True while the API request is in-flight. */
  posting: boolean;
  visibility: ComposeVisibility;
};

const DEFAULT_STATE: ComposeHeaderState = {
  active: false,
  canPost: false,
  posting: false,
  visibility: 'public',
};

let _state: ComposeHeaderState = { ...DEFAULT_STATE };
let _onPost: (() => void) | null = null;
let _onToggleVisibility: (() => void) | null = null;
const _subscribers = new Set<() => void>();

function notify() {
  _subscribers.forEach((fn) => fn());
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function getComposeHeaderState(): ComposeHeaderState {
  return _state;
}

export function subscribeComposeHeader(fn: () => void): () => void {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function updateComposeHeader(updates: Partial<ComposeHeaderState>): void {
  _state = { ..._state, ...updates };
  notify();
}

/** Called by DockPostComposePane on mount — registers submit / toggle callbacks. */
export function registerComposeActions(
  onPost: () => void,
  onToggleVisibility: () => void,
): void {
  _onPost = onPost;
  _onToggleVisibility = onToggleVisibility;
}

/** Called by DockPostComposePane on unmount. */
export function clearComposeHeader(): void {
  _onPost = null;
  _onToggleVisibility = null;
  _state = { ...DEFAULT_STATE };
  notify();
}

// ── Trigger (called from MapDockPill) ─────────────────────────────────────────

export function triggerComposePost(): void {
  _onPost?.();
}

export function triggerComposeToggleVisibility(): void {
  _onToggleVisibility?.();
}

// ── React hook ────────────────────────────────────────────────────────────────

export function useComposeHeader(): ComposeHeaderState {
  const [state, setState] = useState<ComposeHeaderState>(getComposeHeaderState);
  useEffect(() => subscribeComposeHeader(() => setState(getComposeHeaderState())), []);
  return state;
}
