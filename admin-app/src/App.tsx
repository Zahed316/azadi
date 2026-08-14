import { useState, useMemo, lazy, Suspense } from 'react';
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

const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const InsightsPage = lazy(() => import('./pages/InsightsPage'));
const ConfigurePage = lazy(() => import('./pages/ConfigurePage'));
const InfoPage = lazy(() => import('./pages/InfoPage'));

const queryClient = new QueryClient();

function AppInner() {
  const [error, setError] = useState('');

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
    }),
    [currentUser, currentUserLoading, isSuperAdmin, allowedCatId, showToast, confirm, setError],
  );

  if (currentUserLoading) return <LoadingScreen />;

  return (
    <AppContext.Provider value={ctxValue}>
      <HashRouter>
        <div className="container" style={{ paddingBottom: '80px' }}>
          {error && (
            <div className="error" role="alert" aria-live="assertive">
              {error}
            </div>
          )}
          <Toast toast={toast} />
          {ConfirmModal}
          <main>
            <Suspense fallback={<LoadingScreen />}>
              <ErrorBoundary>
                <Routes>
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
                    path="/configure"
                    element={
                      isSuperAdmin ? <ConfigurePage /> : <Navigate to="/inventory" replace />
                    }
                  />
                  <Route
                    path="/info"
                    element={isSuperAdmin ? <InfoPage /> : <Navigate to="/inventory" replace />}
                  />
                  {/* Redirect old routes to grouped pages */}
                  <Route path="/settings" element={<Navigate to="/configure" replace />} />
                  <Route path="/branches" element={<Navigate to="/info" replace />} />
                  <Route path="/faqs" element={<Navigate to="/info" replace />} />
                  <Route path="/admins" element={<Navigate to="/configure" replace />} />
                  <Route path="/menu-config" element={<Navigate to="/configure" replace />} />
                  <Route path="/streaks" element={<Navigate to="/insights" replace />} />
                  <Route path="/favorites" element={<Navigate to="/insights" replace />} />
                  <Route path="/ai-logs" element={<Navigate to="/insights" replace />} />
                  <Route path="/ai-test" element={<Navigate to="/insights" replace />} />
                  <Route path="/messages" element={<Navigate to="/info" replace />} />
                  <Route path="*" element={<Navigate to="/inventory" replace />} />
                </Routes>
              </ErrorBoundary>
            </Suspense>
          </main>
          <nav className="bottom-nav" aria-label="ناوبری اصلی">
            <NavLink
              to="/inventory"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={scrollToTop}
            >
              <span className="nav-icon">📋</span>موجودی
            </NavLink>
            {isSuperAdmin && (
              <>
                <NavLink
                  to="/insights"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={scrollToTop}
                >
                  <span className="nav-icon">📊</span>آمار و گزارش
                </NavLink>
                <NavLink
                  to="/configure"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={scrollToTop}
                >
                  <span className="nav-icon">⚙️</span>تنظیمات
                </NavLink>
                <NavLink
                  to="/info"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={scrollToTop}
                >
                  <span className="nav-icon">ℹ️</span>اطلاعات
                </NavLink>
              </>
            )}
          </nav>
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
