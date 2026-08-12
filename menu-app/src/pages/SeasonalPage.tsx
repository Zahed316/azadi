import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Spinner from '../components/Spinner';
import ProductRow from '../components/ProductRow';
import type { Product, Settings } from '../api/types';

export default function SeasonalPage() {
  const { data: products, isLoading } = useQuery({
    queryKey: queryKeys.seasonal,
    queryFn: () => apiFetch<Product[]>('/products/seasonal', 'products'),
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<Settings>('/settings', 'settings'),
  });

  const priceUnit = settings?.price_unit ?? 'تومان';

  if (isLoading) return <Spinner />;

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
        <div className="empty-state">محصول فصلی یافت نشد</div>
      )}
    </>
  );
}
