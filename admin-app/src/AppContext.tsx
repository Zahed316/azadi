import { createContext, useContext } from 'react';
import type { Admin } from './api/types';

export interface AppContextValue {
  currentUser: Admin | undefined;
  currentUserLoading: boolean;
  isSuperAdmin: boolean;
  allowedCatId: number | undefined;
  showToast: (msg: string, kind?: 'success' | 'error') => void;
  confirm: (message: string) => Promise<boolean>;
  setError: (msg: string) => void;
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- useAppContext hook intentionally co-located with the AppContext default export
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContext.Provider');
  return ctx;
}

export default AppContext;
