import { useState } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import LoadingScreen from './components/Spinner';
import { useToast, Toast } from './components/Toast';
import { useConfirm } from './components/ConfirmDialog';
import AppContext from './AppContext';
import { apiFetch } from './api/client';
import { queryKeys } from './api/keys';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import BranchesPage from './pages/BranchesPage';
import ContentPage from './pages/ContentPage';
import SettingsPage from './pages/SettingsPage';
import AdminsPage from './pages/AdminsPage';
import MenuConfigPage from './pages/MenuConfigPage';

const queryClient = new QueryClient();

function AppInner() {
  const [error, setError] = useState('');

  const { toast, showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: () => apiFetch<{ user: any }>('/currentUser').then((r) => r.user),
    staleTime: Infinity,
  });

  const currentUser = currentUserQuery.data;
  const currentUserLoading = currentUserQuery.isLoading;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const allowedCatId = currentUser?.categoryId as number | undefined;

  const ctxValue = {
    currentUser,
    currentUserLoading,
    isSuperAdmin,
    allowedCatId,
    showToast,
    confirm,
    setError,
  };

  if (currentUserLoading) return <LoadingScreen />;

  return (
    <AppContext.Provider value={ctxValue}>
      <HashRouter>
        <div className="container" style={{ paddingBottom: '80px' }}>
          {error && <div className="error">{error}</div>}
          <Toast toast={toast} />
          {ConfirmModal}
          <Routes>
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route
              path="/branches"
              element={isSuperAdmin ? <BranchesPage /> : <Navigate to="/products" replace />}
            />
            <Route
              path="/faqs"
              element={isSuperAdmin ? <ContentPage /> : <Navigate to="/products" replace />}
            />
            <Route
              path="/settings"
              element={isSuperAdmin ? <SettingsPage /> : <Navigate to="/products" replace />}
            />
            <Route
              path="/admins"
              element={isSuperAdmin ? <AdminsPage /> : <Navigate to="/products" replace />}
            />
            <Route
              path="/menu-config"
              element={isSuperAdmin ? <MenuConfigPage /> : <Navigate to="/products" replace />}
            />
            <Route path="*" element={<Navigate to="/products" replace />} />
          </Routes>
          <div className="bottom-nav">
            <NavLink
              to="/products"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => window.scrollTo(0, 0)}
            >
              <span className="nav-icon">📦</span>Products
            </NavLink>
            <NavLink
              to="/categories"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => window.scrollTo(0, 0)}
            >
              <span className="nav-icon">🏷️</span>Categories
            </NavLink>
            {isSuperAdmin && (
              <>
                <NavLink
                  to="/settings"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  <span className="nav-icon">⚙️</span>Settings
                </NavLink>
                <NavLink
                  to="/branches"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  <span className="nav-icon">📍</span>Branches
                </NavLink>
                <NavLink
                  to="/faqs"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  <span className="nav-icon">📝</span>Content
                </NavLink>
                <NavLink
                  to="/admins"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  <span className="nav-icon">👥</span>Admins
                </NavLink>
                <NavLink
                  to="/menu-config"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  <span className="nav-icon">📋</span>Menu
                </NavLink>
              </>
            )}
          </div>
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
