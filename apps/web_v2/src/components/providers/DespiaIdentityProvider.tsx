'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DESPIA_IDENTITY_CHANGED_EVENT,
  initializeDespiaIdentity,
  type DespiaIdentitySnapshot,
} from '@/lib/despia/identityVault';

type DespiaIdentityStatus = 'loading' | 'ready' | 'unsupported' | 'error';

type DespiaIdentityContextValue = {
  status: DespiaIdentityStatus;
  guestId: string | null;
  /**
   * A prior cloud-vault identity was found. This can mean a reinstall or
   * another device using the same Apple ID / Google account.
   */
  hasPriorVaultIdentity: boolean;
  /** Last account that claimed this vault; this is a local hint, not auth. */
  associatedAccountId: string | null;
  refresh: () => Promise<void>;
};

const DespiaIdentityContext = createContext<DespiaIdentityContextValue | null>(null);

const INITIAL_VALUE: Omit<DespiaIdentityContextValue, 'refresh'> = {
  status: 'loading',
  guestId: null,
  hasPriorVaultIdentity: false,
  associatedAccountId: null,
};

export function DespiaIdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState(INITIAL_VALUE);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await initializeDespiaIdentity();
      if (!snapshot) {
        setIdentity({ ...INITIAL_VALUE, status: 'unsupported' });
        return;
      }

      setIdentity((current) => ({
        status: 'ready',
        guestId: snapshot.guestId,
        hasPriorVaultIdentity: snapshot.hasPriorVaultIdentity,
        // A simultaneous login claim is newer than a stale in-flight read.
        associatedAccountId: snapshot.associatedAccountId ?? current.associatedAccountId,
      }));
    } catch (error) {
      console.warn('despia identity: vault initialization failed', error);
      setIdentity((current) => ({ ...current, status: 'error' }));
    }
  }, []);

  useEffect(() => {
    const handleIdentityChange = (event: Event) => {
      const detail = (event as CustomEvent<{ associatedAccountId?: unknown }>).detail;
      if (typeof detail?.associatedAccountId !== 'string') return;
      setIdentity((current) => ({
        ...current,
        associatedAccountId: detail.associatedAccountId as string,
      }));
    };

    window.addEventListener(DESPIA_IDENTITY_CHANGED_EVENT, handleIdentityChange);
    void refresh();

    return () => {
      window.removeEventListener(DESPIA_IDENTITY_CHANGED_EVENT, handleIdentityChange);
    };
  }, [refresh]);

  const value = useMemo<DespiaIdentityContextValue>(
    () => ({ ...identity, refresh }),
    [identity, refresh],
  );

  return (
    <DespiaIdentityContext.Provider value={value}>
      {children}
    </DespiaIdentityContext.Provider>
  );
}

export function useDespiaIdentity(): DespiaIdentityContextValue {
  const context = useContext(DespiaIdentityContext);
  if (!context) {
    throw new Error('useDespiaIdentity must be used within DespiaIdentityProvider');
  }
  return context;
}

export type { DespiaIdentitySnapshot };
