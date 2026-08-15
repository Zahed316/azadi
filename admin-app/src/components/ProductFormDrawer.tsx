import { useEffect, useState, useCallback } from 'react';
import { backButton, mainButton } from '@telegram-apps/sdk';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type { CategoriesResponse, ProductRow } from '../api/types';
import { useAppContext } from '../AppContext';
import { useTelegramHaptics } from '../hooks/useTelegramHaptics';
import Field from './Field';

export interface ProductFormData {
  name: string;
  price: number;
  stock: number;
  categoryId: number;
  description: string;
  available: boolean;
  featured: boolean;
  isSeasonal: boolean;
  unit: string;
  priceOnRequest: boolean;
  sizeOptions: string | null;
  syrupOptions: string | null;
  imageUrl: string | null;
}

interface ProductFormDrawerProps {
  product: ProductRow | null;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => void;
  isPending: boolean;
}

export default function ProductFormDrawer({
  product,
  onClose,
  onSubmit,
  isPending,
}: ProductFormDrawerProps) {
  const { showToast } = useAppContext();
  const haptics = useTelegramHaptics();

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<CategoriesResponse>('/categories').then((r) => r.categories),
  });

  // Form state
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product?.price?.toString() ?? '');
  const [stock, setStock] = useState(product?.stock?.toString() ?? '0');
  const [categoryId, setCategoryId] = useState(product?.categoryId?.toString() ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [available, setAvailable] = useState(product?.available ?? true);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [isSeasonal, setIsSeasonal] = useState(product?.isSeasonal ?? false);
  const [unit, setUnit] = useState(product?.unit ?? 'item');
  const [priceOnRequest, setPriceOnRequest] = useState(product?.priceOnRequest ?? false);
  const [sizeOptions, setSizeOptions] = useState(product?.sizeOptions ?? '');
  const [syrupOptions, setSyrupOptions] = useState(product?.syrupOptions ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');

  // Validate form
  const isFormValid = name.trim().length > 0 && categoryId !== '';

  // Wire Telegram mainButton
  useEffect(() => {
    mainButton.setParams({
      text: product ? 'ذخیره' : 'افزودن',
      isEnabled: !isPending && isFormValid,
      isVisible: true,
    });
  }, [product, isPending, isFormValid]);

  // Wire Telegram backButton
  useEffect(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      haptics.tap();
      onClose();
    });
    return () => {
      off();
      backButton.hide();
    };
  }, [onClose, haptics]);

  // mainButton click handler
  useEffect(() => {
    const off = mainButton.onClick(() => {
      if (!isFormValid) {
        haptics.error();
        showToast('لطفا فیلدهای ضروری را پر کنید', 'error');
        return;
      }
      haptics.success();
      onSubmit({
        name: name.trim(),
        price: parseFloat(price) || 0,
        stock: parseInt(stock) || 0,
        categoryId: parseInt(categoryId),
        description,
        available,
        featured,
        isSeasonal,
        unit,
        priceOnRequest,
        sizeOptions: sizeOptions || null,
        syrupOptions: syrupOptions || null,
        imageUrl: imageUrl || null,
      });
    });
    return () => off();
  }, [
    name,
    price,
    stock,
    categoryId,
    description,
    available,
    featured,
    isSeasonal,
    unit,
    priceOnRequest,
    sizeOptions,
    syrupOptions,
    imageUrl,
    product,
    onSubmit,
    isFormValid,
    haptics,
    showToast,
  ]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        haptics.tap();
        onClose();
      }
    },
    [onClose, haptics],
  );

  return (
    <div className="drawer-overlay" onClick={handleOverlayClick}>
      <div className="drawer-panel">
        <div className="drawer-handle" />
        <div className="drawer-content">
          <h3 style={{ margin: '0 0 16px' }}>{product ? 'ویرایش محصول' : 'محصول جدید'}</h3>

          <Field label="نام">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام محصول"
              dir="auto"
              required
            />
          </Field>

          <Field label="قیمت">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              dir="ltr"
              placeholder="0"
            />
          </Field>

          <Field label="موجودی">
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              dir="ltr"
              placeholder="0"
            />
          </Field>

          <Field label="دسته‌بندی">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">انتخاب دسته‌بندی</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="توضیحات">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              dir="auto"
              placeholder="توضیحات محصول"
            />
          </Field>

          <Field label="موجود است">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
          </Field>

          <Field label="⭐ پیشنهاد ویژه">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
          </Field>

          <Field label="🌿 مخصوص فصل">
            <input
              type="checkbox"
              checked={isSeasonal}
              onChange={(e) => setIsSeasonal(e.target.checked)}
            />
          </Field>

          <Field label="💲 قیمت درخواستی">
            <input
              type="checkbox"
              checked={priceOnRequest}
              onChange={(e) => setPriceOnRequest(e.target.checked)}
            />
          </Field>

          <Field label="واحد">
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="item">عدد</option>
              <option value="cup">فنجان</option>
              <option value="kg">کیلوگرم</option>
              <option value="g">گرم</option>
              <option value="slice">برش</option>
              <option value="piece">عدد</option>
            </select>
          </Field>

          <Field label="گزینه‌های سایز (آرایه JSON)">
            <input
              value={sizeOptions}
              onChange={(e) => setSizeOptions(e.target.value)}
              placeholder='["کوچک", "متوسط", "بزرگ"]'
              dir="auto"
            />
          </Field>

          <Field label="گزینه‌های سیروپ (آرایه JSON)">
            <input
              value={syrupOptions}
              onChange={(e) => setSyrupOptions(e.target.value)}
              placeholder='["وانیل", "کارامل"]'
              dir="auto"
            />
          </Field>

          <Field label="آدرس تصویر">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              dir="auto"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
