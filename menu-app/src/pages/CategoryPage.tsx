import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Spinner from '../components/Spinner';
import ProductRow from '../components/ProductRow';
import type { Product, Category, Settings } from '../api/types';

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const catId = Number(id);

  const { data: products, isLoading } = useQuery({
    queryKey: [...queryKeys.products, 'category', id],
    queryFn: () => apiFetch<Product[]>(`/products?categoryId=${id}`, 'products'),
  });

  const { data: categories } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<Category[]>('/categories', 'categories'),
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<Settings>('/settings', 'settings'),
  });

  const category = categories?.find((c) => c.id === catId);
  const priceUnit = settings?.price_unit ?? 'تومان';

  if (isLoading) return <Spinner />;

  return (
    <>
      <Link to="/" className="back-link">بازگشت</Link>
      <div className="page-header">
        <h2 className="page-header-title">{category?.name ?? 'محصولات'}</h2>
        {category?.description && (
          <p className="page-header-sub">{category.description}</p>
        )}
      </div>
      {products?.length ? (
        products.map((p) => (
          <ProductRow key={p.id} product={p} priceUnit={priceUnit} />
        ))
      ) : (
        <div className="empty-state">محصولی یافت نشد</div>
      )}
    </>
  );
}
