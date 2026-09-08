/** Session identity for boot gating — never invent a guest from a timeout. */
export type AuthStatus = 'unknown' | 'anon' | 'signed_in' | 'error';
