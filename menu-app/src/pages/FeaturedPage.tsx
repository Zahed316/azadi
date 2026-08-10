import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import { formatPersianPrice } from '../utils/numbers';
import Spinner from '../components/Spinner';
import ProductImage from '../components/ProductImage';

interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string;
  description?: string;
}

export default function FeaturedPage() {
  const { data: products, isLoading } = useQuery({
    queryKey: queryKeys.featured,
    queryFn: () => apiFetch<Product[]>('/products/featured', 'products'),
  });

  if (isLoading) return <Spinner />;

  return (
    <>
      <Link to="/" className="back-link">بازگشت</Link>
      <h2 className="section-title">محصولات ویژه</h2>
      <div className="grid">
        {products?.map((p) => (
          <Link key={p.id} to={`/product/${p.id}`} className="grid-item">
            <ProductImage src={p.imageUrl} alt={p.name} className="card-image" />
            <div className="card-title">{p.name}</div>
            <div className="card-price">{formatPersianPrice(p.price, p.unit)}</div>
          </Link>
        ))}
      </div>
      {!products?.length && <div className="empty-state">محصول ویژه‌ای یافت نشد</div>}
    </>
  );
}
