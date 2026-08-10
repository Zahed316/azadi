import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import { formatPersianPrice } from '../utils/numbers';
import Spinner from '../components/Spinner';
import ProductImage from '../components/ProductImage';

interface CoffeeDetails {
  origin?: string | null;
  farm?: string | null;
  altitude?: string | null;
  processing?: string | null;
  variety?: string | null;
  roastLevel?: string | null;
  flavorNotes?: string | null;
  recommendedBrew?: string | null;
  acidity?: string | null;
  body?: string | null;
  brewGuide?: string | null;
}

interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string | null;
  description?: string;
  featured?: boolean;
  isSeasonal?: boolean;
  priceOnRequest?: boolean;
  calories?: number | null;
  allergens?: string | null;
  caffeineMg?: number | null;
  coffee_details?: CoffeeDetails | null;
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading } = useQuery({
    queryKey: queryKeys.product(Number(id)),
    queryFn: () => apiFetch<Product>(`/products/${id}`, 'product'),
  });

  if (isLoading) return <Spinner />;
  if (!product) return <div className="empty-state">محصول یافت نشد</div>;

  return (
    <>
      <Link to="/" className="back-link">بازگشت</Link>
      <div className="card">
        <ProductImage src={product.imageUrl} alt={product.name} className="card-image" />
        <h2 className="card-title">{product.name}</h2>
        <div className="card-price">{formatPersianPrice(product.price, product.unit)}</div>
        {product.featured && <span className="badge badge-featured">ویژه</span>}
        {product.isSeasonal && <span className="badge badge-seasonal">فصلی</span>}
        {product.priceOnRequest && <span className="badge badge-featured">قیمت با هماهنگی</span>}
        {product.description && <p className="card-subtitle" style={{ marginTop: 8 }}>{product.description}</p>}
        {(product.calories || product.caffeineMg || product.allergens) && (
          <div className="detail-grid">
            {product.calories && <div className="detail-item"><div className="detail-label">کالری</div>{product.calories}</div>}
            {product.caffeineMg && <div className="detail-item"><div className="detail-label">کافئین</div>{product.caffeineMg} میلی‌گرم</div>}
            {product.allergens && <div className="detail-item"><div className="detail-label">آلرژن‌ها</div>{product.allergens}</div>}
          </div>
        )}
        {product.coffee_details && (
          <div className="detail-grid">
            {product.coffee_details.origin && <div className="detail-item"><div className="detail-label">خاستگاه</div>{product.coffee_details.origin}</div>}
            {product.coffee_details.roastLevel && <div className="detail-item"><div className="detail-label">برشته‌کاری</div>{product.coffee_details.roastLevel}</div>}
            {product.coffee_details.farm && <div className="detail-item"><div className="detail-label">مزارع</div>{product.coffee_details.farm}</div>}
            {product.coffee_details.altitude && <div className="detail-item"><div className="detail-label">ارتفاع</div>{product.coffee_details.altitude}</div>}
            {product.coffee_details.processing && <div className="detail-item"><div className="detail-label">فرآوری</div>{product.coffee_details.processing}</div>}
            {product.coffee_details.variety && <div className="detail-item"><div className="detail-label">واریته</div>{product.coffee_details.variety}</div>}
            {product.coffee_details.flavorNotes && <div className="detail-item"><div className="detail-label">نتایج طعمی</div>{product.coffee_details.flavorNotes}</div>}
            {product.coffee_details.acidity && <div className="detail-item"><div className="detail-label">اسیدیته</div>{product.coffee_details.acidity}</div>}
            {product.coffee_details.body && <div className="detail-item"><div className="detail-label">بدنه</div>{product.coffee_details.body}</div>}
          </div>
        )}
        {product.coffee_details?.brewGuide && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
            <div className="detail-label">راهنمای دم‌آوری</div>
            <p style={{ marginTop: 4, fontSize: 14 }}>{product.coffee_details.brewGuide}</p>
          </div>
        )}
      </div>
    </>
  );
}
