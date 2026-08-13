import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import { formatPersianPrice, toPersianDigits } from '../utils/numbers';
import Spinner from '../components/Spinner';
import ProductImage from '../components/ProductImage';
import type { Product, Settings } from '../api/types';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading } = useQuery({
    queryKey: queryKeys.product(Number(id)),
    queryFn: () => apiFetch<Product>(`/products/${id}`, 'product'),
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<Settings>('/settings', 'settings'),
  });

  const priceUnit = settings?.price_unit ?? 'تومان';

  if (isLoading) return <Spinner />;
  if (!product) return <div className="empty-state">محصول یافت نشد</div>;

  const d = product.coffee_details;
  const hasDetails =
    d &&
    (d.origin ||
      d.farm ||
      d.altitude ||
      d.processing ||
      d.variety ||
      d.roastLevel ||
      d.acidity ||
      d.body);

  return (
    <>
      <Link to="/" className="back-link">
        بازگشت
      </Link>

      {/* ── Hero image ── */}
      <div className="product-hero">
        <ProductImage src={product.imageUrl} alt={product.name} className="product-hero-img" />
      </div>

      {/* ── Title + badges ── */}
      <div className="product-title-block">
        <h1 className="product-title">{product.name}</h1>
        <div className="product-badges">
          {product.featured && <span className="product-badge product-badge--featured">ویژه</span>}
          {product.isSeasonal && (
            <span className="product-badge product-badge--seasonal">فصلی</span>
          )}
          {product.priceOnRequest && (
            <span className="product-badge product-badge--featured">قیمت با هماهنگی</span>
          )}
        </div>
      </div>

      {/* ── Price row with dot leader ── */}
      <div className="product-price-row">
        <span className="product-row-dots" />
        <span className="product-price-value">
          {product.priceOnRequest
            ? 'قیمت با هماهنگی'
            : formatPersianPrice(product.price, priceUnit)}
        </span>
      </div>

      {/* ── Description ── */}
      {product.description && <p className="product-description">{product.description}</p>}

      {/* ── Spec sheet: coffee details ── */}
      {hasDetails && (
        <dl className="spec-sheet">
          {d.origin && <SpecRow label="خاستگاه" value={d.origin} />}
          {d.roastLevel && <SpecRow label="برشته‌کاری" value={d.roastLevel} />}
          {d.farm && <SpecRow label="مزارع" value={d.farm} />}
          {d.altitude && <SpecRow label="ارتفاع" value={d.altitude} />}
          {d.processing && <SpecRow label="فرآوری" value={d.processing} />}
          {d.variety && <SpecRow label="واریته" value={d.variety} />}
          {d.acidity && <SpecRow label="اسیدیته" value={d.acidity} />}
          {d.body && <SpecRow label="بدنه" value={d.body} />}
        </dl>
      )}

      {/* ── Flavor notes as tags ── */}
      {d?.flavorNotes && (
        <div className="flavor-tags">
          {d.flavorNotes.split(/[,،/]+/).map((note, i) => (
            <span key={i} className="flavor-tag">
              {note.trim()}
            </span>
          ))}
        </div>
      )}

      {/* ── Nutrition row ── */}
      {(product.calories || product.caffeineMg || product.allergens) && (
        <div className="nutrition-row">
          {product.calories && (
            <div className="nutrition-item">
              <span className="nutrition-label">کالری</span>
              <span className="nutrition-value">{toPersianDigits(product.calories)}</span>
            </div>
          )}
          {product.caffeineMg && (
            <div className="nutrition-item">
              <span className="nutrition-label">کافئین</span>
              <span className="nutrition-value">
                {toPersianDigits(product.caffeineMg)} میلی‌گرم
              </span>
            </div>
          )}
          {product.allergens && (
            <div className="nutrition-item">
              <span className="nutrition-label">آلرژن‌ها</span>
              <span className="nutrition-value">{product.allergens}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Brew guide inset ── */}
      {d?.brewGuide && (
        <div className="brew-guide">
          <div className="brew-guide-label">راهنمای دم‌آوری</div>
          <p className="brew-guide-text">{d.brewGuide}</p>
        </div>
      )}
    </>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="spec-row">
      <dt className="spec-label">{label}</dt>
      <dd className="spec-value">{value}</dd>
    </div>
  );
}
