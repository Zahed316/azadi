import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import { formatPersianPrice } from '../utils/numbers';
import Spinner from '../components/Spinner';

interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string;
  description?: string;
  isFeatured?: boolean;
  isSeasonal?: boolean;
}

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const { data: products, isLoading } = useQuery({
    queryKey: [...queryKeys.products, 'category', id],
    queryFn: () => apiFetch<Product[]>(`/products?categoryId=${id}`),
  });

  if (isLoading) return <Spinner />;

  return (
    <>
      <Link to="/" className="back-link">بازگشت</Link>
      <h2 className="section-title">محصولات</h2>
      <div className="grid">
        {products?.map((p) => (
          <Link key={p.id} to={`/product/${p.id}`} className="grid-item">
            {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="card-image" />}
            <div className="card-title">{p.name}</div>
            <div className="card-price">{formatPersianPrice(p.price, p.unit)}</div>
            {p.isFeatured && <span className="badge badge-featured">ویژه</span>}
            {p.isSeasonal && <span className="badge badge-seasonal">فصلی</span>}
          </Link>
        ))}
      </div>
      {!products?.length && <div className="empty-state">محصولی یافت نشد</div>}
    </>
  );
}
