import { createContext, useContext } from 'react';

export interface AppContextValue {
  currentUser: any;
  currentUserLoading: boolean;
  isSuperAdmin: boolean;
  allowedCatId: number | undefined;
  showToast: (msg: string, kind?: 'success' | 'error') => void;
  confirm: (message: string) => Promise<boolean>;
  setError: (msg: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- useAppContext hook intentionally co-located with the AppContext default export
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContext.Provider');
  return ctx;
}

export default AppContext;
