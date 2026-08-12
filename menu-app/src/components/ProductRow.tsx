import { Link } from 'react-router-dom';
import { formatPersianPrice } from '../utils/numbers';
import ProductImage from './ProductImage';
import type { Product } from '../api/types';

interface ProductRowProps {
  product: Product;
  priceUnit?: string;
  className?: string;
}

export default function ProductRow({ product, priceUnit = 'تومان', className }: ProductRowProps) {
  const isUnavailable = product.available === false;
  const priceText = product.priceOnRequest
    ? 'قیمت با هماهنگی'
    : formatPersianPrice(product.price, priceUnit);

  return (
    <Link
      to={`/product/${product.id}`}
      className={`product-row ${isUnavailable ? 'product-row--unavailable' : ''} ${className ?? ''}`}
    >
      <div className="product-row-thumb">
        <ProductImage src={product.imageUrl} alt={product.name} />
      </div>

      <div className="product-row-body">
        <div className="product-row-top">
          <span className="product-row-name">{product.name}</span>
          {product.featured && <span className="product-badge product-badge--featured">ویژه</span>}
          {product.isSeasonal && (
            <span className="product-badge product-badge--seasonal">فصلی</span>
          )}
          {product.priceOnRequest && (
            <span className="product-badge product-badge--featured">هماهنگی</span>
          )}
        </div>
        <div className="product-row-price-row">
          <span className="product-row-dots" />
          <span className="product-row-price">{isUnavailable ? 'ناموجود' : priceText}</span>
        </div>
      </div>
    </Link>
  );
}
