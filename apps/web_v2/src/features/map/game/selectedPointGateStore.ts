/**
 * Stores the last "out of range" error from the selected-point radius gate.
 * Consumed by DockSelectedPointPane to show an inline dock-level error.
 * Auto-clears after LINGER_MS — no React state required.
 */

const LINGER_MS = 3_000;

type Listener = () => void;

let error: string | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function getSelectedPointGateError(): string | null {
  return error;
}

export function subscribeSelectedPointGateError(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSelectedPointGateError(message: string): void {
  if (clearTimer) clearTimeout(clearTimer);
  error = message;
  emit();
  clearTimer = setTimeout(() => {
    error = null;
    clearTimer = null;
    emit();
  }, LINGER_MS);
}

export function clearSelectedPointGateError(): void {
  if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
  if (error === null) return;
  error = null;
  emit();
}
