import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from './components/Header';
import Footer from './components/Footer';
import Spinner from './components/Spinner';
import { useReveal } from './hooks/useReveal';

const HomePage = lazy(() => import('./pages/HomePage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const FeaturedPage = lazy(() => import('./pages/FeaturedPage'));
const SeasonalPage = lazy(() => import('./pages/SeasonalPage'));
const BranchesPage = lazy(() => import('./pages/BranchesPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  const revealRef = useReveal();

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Header />
        <main className="container" ref={revealRef}>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/category/:id" element={<CategoryPage />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/featured" element={<FeaturedPage />} />
              <Route path="/seasonal" element={<SeasonalPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </HashRouter>
    </QueryClientProvider>
  );
}
