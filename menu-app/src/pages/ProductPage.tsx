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
  calories?: number;
  caffeine?: string;
  allergens?: string;
  farm?: string;
  altitude?: string;
  processing?: string;
  brewGuide?: string;
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading } = useQuery({
    queryKey: queryKeys.product(Number(id)),
    queryFn: () => apiFetch<Product>(`/products/${id}`),
  });

  if (isLoading) return <Spinner />;
  if (!product) return <div className="empty-state">محصول یافت نشد</div>;

  return (
    <>
      <Link to="/" className="back-link">بازگشت</Link>
      <div className="card">
        {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="card-image" />}
        <h2 className="card-title">{product.name}</h2>
        <div className="card-price">{formatPersianPrice(product.price, product.unit)}</div>
        {product.isFeatured && <span className="badge badge-featured">ویژه</span>}
        {product.isSeasonal && <span className="badge badge-seasonal">فصلی</span>}
        {product.description && <p className="card-subtitle" style={{ marginTop: 8 }}>{product.description}</p>}
        {(product.calories || product.caffeine || product.allergens) && (
          <div className="detail-grid">
            {product.calories && <div className="detail-item"><div className="detail-label">کالری</div>{product.calories}</div>}
            {product.caffeine && <div className="detail-item"><div className="detail-label">کافئین</div>{product.caffeine}</div>}
            {product.allergens && <div className="detail-item"><div className="detail-label">آلرژن‌ها</div>{product.allergens}</div>}
          </div>
        )}
        {(product.farm || product.altitude || product.processing) && (
          <div className="detail-grid">
            {product.farm && <div className="detail-item"><div className="detail-label">مزارع</div>{product.farm}</div>}
            {product.altitude && <div className="detail-item"><div className="detail-label">ارتفاع</div>{product.altitude}</div>}
            {product.processing && <div className="detail-item"><div className="detail-label">فرآوری</div>{product.processing}</div>}
          </div>
        )}
        {product.brewGuide && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
            <div className="detail-label">راهنمای دم‌آوری</div>
            <p style={{ marginTop: 4, fontSize: 14 }}>{product.brewGuide}</p>
          </div>
        )}
      </div>
    </>
  );
}
