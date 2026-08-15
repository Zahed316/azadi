import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type { CategoriesResponse, ProductRow } from '../api/types';
import { useAppContext } from '../AppContext';
import Field from './Field';
import InventoryList from './InventoryList';

export default function ProductsSubTab() {
  const { isSuperAdmin, allowedCatId, setError, showToast } = useAppContext();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<CategoriesResponse>('/categories').then((r) => r.categories),
  });

  // Editing
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  // Form
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodCatId, setProdCatId] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodSeasonal, setProdSeasonal] = useState(false);
  const [prodUnit, setProdUnit] = useState('item');
  const [prodSizeOptions, setProdSizeOptions] = useState('');
  const [prodSyrupOptions, setProdSyrupOptions] = useState('');
  const [prodPriceOnRequest, setProdPriceOnRequest] = useState(false);
  const [prodImageUrl, setProdImageUrl] = useState('');

  const resetProductForm = () => {
    setEditingProduct(null);
    setProdName('');
    setProdPrice('');
    setProdStock('');
    setProdCatId('');
    setProdDesc('');
    setProdAvailable(true);
    setProdFeatured(false);
    setProdSeasonal(false);
    setProdUnit('item');
    setProdPriceOnRequest(false);
    setProdSizeOptions('');
    setProdSyrupOptions('');
    setProdImageUrl('');
  };

  const startEditProduct = (p: ProductRow) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdPrice(p.price?.toString() || '');
    setProdStock(p.stock?.toString() || '0');
    setProdCatId(p.categoryId?.toString() || '');
    setProdDesc(p.description || '');
    setProdAvailable(p.available ?? false);
    setProdFeatured(p.featured ?? false);
    setProdSeasonal(p.isSeasonal ?? false);
    setProdUnit(p.unit || 'item');
    setProdPriceOnRequest(p.priceOnRequest ?? false);
    setProdSizeOptions(p.sizeOptions || '');
    setProdSyrupOptions(p.syrupOptions || '');
    setProdImageUrl(p.imageUrl || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Mutations
  const saveProductMutation = useMutation({
    mutationFn: async (data: {
      method: string;
      id?: number;
      body: {
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
      };
      imageUrl?: string | null;
    }) => {
      const result = await apiFetch<{ success: boolean }>(
        data.id ? `/products/${data.id}` : '/products',
        { method: data.method, body: data.body },
      );
      if (data.id && data.imageUrl !== undefined) {
        if (data.imageUrl) {
          await apiFetch(`/products/${data.id}/image`, {
            method: 'PUT',
            body: { imageUrl: data.imageUrl },
          });
        } else if (data.body.imageUrl === null) {
          await apiFetch(`/products/${data.id}/image`, { method: 'DELETE' });
        }
      }
      return result;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      resetProductForm();
      showToast(variables.id ? 'محصول به‌روزرسانی شد ✓' : 'محصول اضافه شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    saveProductMutation.mutate({
      method: editingProduct ? 'PUT' : 'POST',
      id: editingProduct?.id,
      body: {
        name: prodName,
        price: parseFloat(prodPrice),
        stock: parseInt(prodStock),
        categoryId: parseInt(prodCatId),
        description: prodDesc,
        available: prodAvailable,
        featured: prodFeatured,
        isSeasonal: prodSeasonal,
        unit: prodUnit,
        priceOnRequest: prodPriceOnRequest,
        sizeOptions: prodSizeOptions || null,
        syrupOptions: prodSyrupOptions || null,
        imageUrl: prodImageUrl || null,
      },
      imageUrl: editingProduct?.id ? prodImageUrl || null : undefined,
    });
  };

  return (
    <>
      {/* Product list (self-contained) */}
      <InventoryList onEdit={startEditProduct} />

      {/* Add/Edit form */}
      {(isSuperAdmin || allowedCatId) && (
        <div className="card">
          <h2>{editingProduct ? 'ویرایش محصول' : 'افزودن محصول'}</h2>
          <form onSubmit={handleSaveProduct}>
            <Field label="نام">
              <input value={prodName} onChange={(e) => setProdName(e.target.value)} required />
            </Field>
            <Field label="قیمت">
              <input
                type="number"
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                required
              />
            </Field>
            <Field label="موجودی">
              <input
                type="number"
                value={prodStock}
                onChange={(e) => setProdStock(e.target.value)}
                required
              />
            </Field>
            <Field label="دسته‌بندی">
              <select value={prodCatId} onChange={(e) => setProdCatId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="توضیحات">
              <textarea value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} />
            </Field>
            <Field label="موجود است">
              <input
                type="checkbox"
                checked={prodAvailable}
                onChange={(e) => setProdAvailable(e.target.checked)}
              />
            </Field>
            <Field label="⭐ پیشنهاد ویژه">
              <input
                type="checkbox"
                checked={prodFeatured}
                onChange={(e) => setProdFeatured(e.target.checked)}
              />
            </Field>
            <Field label="🌿 مخصوص فصل">
              <input
                type="checkbox"
                checked={prodSeasonal}
                onChange={(e) => setProdSeasonal(e.target.checked)}
              />
            </Field>
            <Field label="💲 قیمت درخواستی">
              <input
                type="checkbox"
                checked={prodPriceOnRequest}
                onChange={(e) => setProdPriceOnRequest(e.target.checked)}
              />
            </Field>
            <Field label="واحد">
              <select value={prodUnit} onChange={(e) => setProdUnit(e.target.value)}>
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
                value={prodSizeOptions}
                onChange={(e) => setProdSizeOptions(e.target.value)}
                placeholder='["کوچک", "متوسط", "بزرگ"]'
                dir="auto"
              />
            </Field>
            <Field label="گزینه‌های سیروپ (آرایه JSON)">
              <input
                value={prodSyrupOptions}
                onChange={(e) => setProdSyrupOptions(e.target.value)}
                placeholder='["وانیل", "کارامل"]'
                dir="auto"
              />
            </Field>
            <Field label="آدرس تصویر">
              <input
                value={prodImageUrl}
                onChange={(e) => setProdImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                dir="auto"
              />
            </Field>
            <button type="submit" className="primary" disabled={saveProductMutation.isPending}>
              {saveProductMutation.isPending
                ? '⏳...'
                : (editingProduct ? 'به‌روزرسانی' : 'افزودن') + ' محصول'}
            </button>
            {editingProduct && (
              <button type="button" className="secondary" onClick={resetProductForm}>
                انصراف
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
