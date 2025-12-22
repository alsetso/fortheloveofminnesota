'use client';

import { ReactNode, createContext, useContext } from 'react';
import type { ServerAuthUser } from '@/lib/authServer';

interface ServerAuthContextType {
  auth: ServerAuthUser | null;
}

const ServerAuthContext = createContext<ServerAuthContextType | undefined>(undefined);

interface ServerAuthProviderProps {
  children: ReactNode;
  auth: ServerAuthUser | null;
}

/**
 * ServerAuthProvider - Passes server-side auth data to client components
 * 
 * Use this to avoid client-side auth flash by passing server-rendered auth state.
 * Wrap components that need auth data with this provider.
 */
export function ServerAuthProvider({ children, auth }: ServerAuthProviderProps) {
  return (
    <ServerAuthContext.Provider value={{ auth }}>
      {children}
    </ServerAuthContext.Provider>
  );
}

/**
 * useServerAuth - Hook to access server-side auth data in client components
 * 
 * Returns the auth data passed from server components.
 * Falls back to client-side auth if server auth is not available.
 */
export function useServerAuth(): ServerAuthUser | null {
  const context = useContext(ServerAuthContext);
  return context?.auth || null;
}



