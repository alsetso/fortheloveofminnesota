/**
 * True when the request is served from a local dev host (loopback).
 * Accepts `Host` header values (e.g. `localhost:3002`) or `window.location.hostname`.
 */
export function isLocalhostHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const lower = host.toLowerCase().trim();
  if (lower === 'localhost' || lower.startsWith('localhost:')) return true;
  if (lower === '127.0.0.1' || lower.startsWith('127.0.0.1:')) return true;
  if (lower === '[::1]' || lower.startsWith('[::1]:')) return true;
  if (lower === '::1') return true;
  return false;
}
