'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type WorkViewRole = 'worker' | 'employer';

type WorkViewContextValue = {
  viewAs: WorkViewRole;
  setViewAs: (role: WorkViewRole) => void;
};

const WorkViewContext = createContext<WorkViewContextValue | undefined>(undefined);

export function WorkViewProvider({ children }: { children: React.ReactNode }) {
  const [viewAs, setViewAsState] = useState<WorkViewRole>('worker');
  const setViewAs = useCallback((role: WorkViewRole) => {
    setViewAsState(role);
  }, []);

  const value = useMemo(
    () => ({ viewAs, setViewAs }),
    [viewAs, setViewAs]
  );

  return (
    <WorkViewContext.Provider value={value}>
      {children}
    </WorkViewContext.Provider>
  );
}

export function useWorkView(): WorkViewContextValue {
  const ctx = useContext(WorkViewContext);
  if (ctx === undefined) {
    return {
      viewAs: 'worker',
      setViewAs: () => {},
    };
  }
  return ctx;
}
