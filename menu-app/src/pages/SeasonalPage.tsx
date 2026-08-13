import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import CategorySkeleton from '../components/skeletons/CategorySkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ProductRow from '../components/ProductRow';
import type { Product, Settings } from '../api/types';

export default function SeasonalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: products,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.seasonal,
    queryFn: () => apiFetch<Product[]>('/products/seasonal', 'products'),
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<Settings>('/settings', 'settings'),
  });

  const priceUnit = settings?.price_unit ?? 'تومان';

  if (isLoading) return <CategorySkeleton />;
  if (isError)
    return (
      <ErrorState
        message="خطا در بارگذاری محصولات فصلی"
        detail={error?.message}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.seasonal });
        }}
      />
    );

  return (
    <>
      <Link to="/" className="back-link">
        بازگشت
      </Link>
      <div className="page-header">
        <h2 className="page-header-title">محصولات فصلی</h2>
      </div>
      {products?.length ? (
        products.map((p) => <ProductRow key={p.id} product={p} priceUnit={priceUnit} />)
      ) : (
        <EmptyState
          message="محصول فصلی یافت نشد"
          detail="محصولات فصلی فعلی تمام شده‌اند"
          action={{ label: 'بازگشت به خانه', onClick: () => navigate('/') }}
        />
      )}
    </>
  );
}
