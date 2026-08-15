import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import LoadingScreen from './components/Spinner';
import { useToast, Toast } from './components/Toast';
import { useConfirm } from './components/ConfirmDialog';
import AppContext from './AppContext';
import { apiFetch } from './api/client';
import { queryKeys } from './api/keys';
import type { CurrentUserResponse } from './api/types';
import { ErrorBoundary } from './components/ErrorBoundary';
import IconSprite from './components/IconSprite';
import Icon from './components/Icon';
import ChatPanel from './components/ChatPanel';

const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const InsightsPage = lazy(() => import('./pages/InsightsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CounterPage = lazy(() => import('./pages/CounterPage'));

const queryClient = new QueryClient();

function AppInner() {
  const [error, setError] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const openChat = useCallback(() => setIsChatOpen(true), []);
  const closeChat = useCallback(() => setIsChatOpen(false), []);

  const { toast, showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: () => apiFetch<CurrentUserResponse>('/currentUser').then((r) => r.user),
    staleTime: Infinity,
  });

  const currentUser = currentUserQuery.data;
  const currentUserLoading = currentUserQuery.isLoading;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const allowedCatId = currentUser?.categoryId as number | undefined;

  const scrollToTop = () => window.scrollTo(0, 0);

  const ctxValue = useMemo(
    () => ({
      currentUser,
      currentUserLoading,
      isSuperAdmin,
      allowedCatId,
      showToast,
      confirm,
      setError,
      isChatOpen,
      openChat,
      closeChat,
    }),
    [
      currentUser,
      currentUserLoading,
      isSuperAdmin,
      allowedCatId,
      showToast,
      confirm,
      setError,
      isChatOpen,
      openChat,
      closeChat,
    ],
  );

  if (currentUserLoading) return <LoadingScreen />;

  return (
    <AppContext.Provider value={ctxValue}>
      <HashRouter>
        <IconSprite />
        <div className="container" style={{ paddingBottom: '80px' }}>
          {error && (
            <div className="error" role="alert" aria-live="assertive">
              {error}
            </div>
          )}
          <Toast toast={toast} />
          {ConfirmModal}
          <main className="page-enter">
            <Suspense fallback={<LoadingScreen />}>
              <ErrorBoundary>
                <Routes>
                  <Route path="/counter" element={<CounterPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  {/* Legacy routes redirect to inventory with appropriate sub-tab */}
                  <Route
                    path="/products"
                    element={<Navigate to="/inventory?tab=products" replace />}
                  />
                  <Route
                    path="/categories"
                    element={<Navigate to="/inventory?tab=categories" replace />}
                  />
                  {/* Grouped tabs */}
                  <Route
                    path="/insights"
                    element={isSuperAdmin ? <InsightsPage /> : <Navigate to="/inventory" replace />}
                  />
                  <Route
                    path="/settings"
                    element={isSuperAdmin ? <SettingsPage /> : <Navigate to="/inventory" replace />}
                  />
                  {/* Redirect old routes to grouped pages */}
                  <Route path="/configure" element={<Navigate to="/settings" replace />} />
                  <Route path="/info" element={<Navigate to="/settings" replace />} />
                  <Route path="/branches" element={<Navigate to="/settings" replace />} />
                  <Route path="/faqs" element={<Navigate to="/settings" replace />} />
                  <Route path="/admins" element={<Navigate to="/settings" replace />} />
                  <Route path="/menu-config" element={<Navigate to="/settings" replace />} />
                  <Route path="/streaks" element={<Navigate to="/insights" replace />} />
                  <Route path="/favorites" element={<Navigate to="/insights" replace />} />
                  <Route path="/ai-logs" element={<Navigate to="/insights" replace />} />
                  <Route path="/ai-test" element={<Navigate to="/insights" replace />} />
                  <Route path="/messages" element={<Navigate to="/settings" replace />} />
                  <Route
                    path="*"
                    element={<Navigate to={isSuperAdmin ? '/inventory' : '/counter'} replace />}
                  />
                </Routes>
              </ErrorBoundary>
            </Suspense>
          </main>
          <nav className="bottom-nav" aria-label="ناوبری اصلی">
            {isSuperAdmin ? (
              <>
                <NavLink
                  to="/inventory"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={scrollToTop}
                >
                  <span className="nav-icon">📋</span>موجودی
                </NavLink>
                <NavLink
                  to="/insights"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={scrollToTop}
                >
                  <span className="nav-icon">📊</span>آمار و گزارش
                </NavLink>
                <NavLink
                  to="/settings"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={scrollToTop}
                >
                  <span className="nav-icon">⚙️</span>تنظیمات
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to="/counter"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={scrollToTop}
                >
                  <span className="nav-icon">📋</span>پیشخوان
                </NavLink>
                <NavLink
                  to="/inventory?tab=products"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={scrollToTop}
                >
                  <span className="nav-icon">📦</span>موجودی
                </NavLink>
              </>
            )}
            <button
              type="button"
              className={`nav-item ${isChatOpen ? 'active' : ''}`}
              onClick={() => (isChatOpen ? closeChat() : openChat())}
              aria-label="دستیار"
            >
              <Icon name="chat" size={18} />
              <span style={{ marginRight: 6 }}>دستیار</span>
            </button>
          </nav>
          {isChatOpen && (
            <Suspense fallback={null}>
              <ChatPanel onClose={closeChat} />
            </Suspense>
          )}
        </div>
      </HashRouter>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
