import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type { ProductsResponse, CategoriesResponse, ProductRow } from '../api/types';
import { useAppContext } from '../AppContext';
import Field from './Field';
import EmptyState from './EmptyState';
import { ProductSkeleton } from './SkeletonLoader';

export default function ProductsSubTab() {
  const { isSuperAdmin, allowedCatId, setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: queryKeys.products,
    queryFn: () => apiFetch<ProductsResponse>('/products').then((r) => r.products),
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<CategoriesResponse>('/categories').then((r) => r.categories),
  });

  // Category filter (chip picker)
  const [filterCatId, setFilterCatId] = useState<number | null>(null);

  // Batch
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [batchAction, setBatchAction] = useState<'move' | 'toggle' | 'delete' | ''>('');
  const [batchTargetCatId, setBatchTargetCatId] = useState('');
  const [batchToggleValue, setBatchToggleValue] = useState('true');

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

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterCatId !== null && p.categoryId !== filterCatId) return false;
      return true;
    });
  }, [products, filterCatId]);

  const toggleProductSelect = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      showToast('محصول حذف شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const toggleProductField = useMutation({
    mutationFn: ({ id, field, value }: { id: number; field: string; value: boolean }) =>
      field === 'available'
        ? apiFetch(`/products/${id}/toggle`, { method: 'PUT', body: { available: value } })
        : apiFetch(`/products/${id}`, { method: 'PUT', body: { [field]: value } }),
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products });
      const prev = queryClient.getQueryData(queryKeys.products);
      queryClient.setQueryData<ProductRow[]>(queryKeys.products, (old) =>
        old?.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(queryKeys.products, context.prev);
      showToast('خطا در تغییر وضعیت', 'error');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });

  const batchMutation = useMutation({
    mutationFn: (data: { ids: number[]; action: string; updateData?: Record<string, unknown> }) =>
      apiFetch('/products/batch', { method: 'POST', body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      setSelectedProductIds([]);
      setBatchAction('');
      showToast('عملیات گروهی انجام شد ✓');
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

  const deleteProduct = async (id: number) => {
    if (!(await confirm('مطمئن هستید این محصول حذف شود؟'))) return;
    deleteProductMutation.mutate(id);
  };

  const handleBatchExecute = async () => {
    if (!batchAction || selectedProductIds.length === 0) return;
    if (!(await confirm(`عملیات روی ${selectedProductIds.length} محصول اعمال شود؟`))) return;
    let updateData = undefined;
    if (batchAction === 'move') updateData = { categoryId: parseInt(batchTargetCatId) };
    if (batchAction === 'toggle') updateData = { available: batchToggleValue === 'true' };
    batchMutation.mutate({
      ids: selectedProductIds,
      action: batchAction === 'delete' ? 'delete' : 'update',
      updateData,
    });
  };

  if (isLoading) return <ProductSkeleton />;

  return (
    <>
      {/* Category picker */}
      <div className="category-picker">
        <button
          type="button"
          className={`category-chip${filterCatId === null ? ' active' : ''}`}
          onClick={() => setFilterCatId(null)}
        >
          همه
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`category-chip${filterCatId === c.id ? ' active' : ''}`}
            onClick={() => setFilterCatId(c.id)}
          >
            {c.emoji && `${c.emoji} `}
            {c.name}
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="product-list">
        {filteredProducts.length === 0 ? (
          <EmptyState
            message={
              filterCatId !== null
                ? 'محصولی در این دسته‌بندی وجود ندارد.'
                : 'هنوز محصولی وجود ندارد. برای شروع اولین محصول را اضافه کنید.'
            }
          />
        ) : (
          filteredProducts.map((p) => (
            <div key={p.id} className="product-item">
              {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="product-thumb" />}
              <div className="product-info">
                <div className="product-name-row">
                  <span dir="auto">{p.name}</span>
                  {p.featured && <span title="پیشنهاد ویژه">⭐</span>}
                  {p.isSeasonal && <span title="مخصوص فصل">🌿</span>}
                </div>
                <span className="list-item-meta">
                  {p.price}
                  {p.unit && p.unit !== 'item' && (
                    <span style={{ marginLeft: 4, fontSize: '0.85em', opacity: 0.7 }}>
                      /{p.unit}
                    </span>
                  )}
                </span>
              </div>
              {(isSuperAdmin || allowedCatId) && (
                <>
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(p.id)}
                    onChange={() => toggleProductSelect(p.id)}
                  />
                  <div className="list-item-actions">
                    <button
                      className="secondary"
                      onClick={() =>
                        toggleProductField.mutate({
                          id: p.id,
                          field: 'available',
                          value: !p.available,
                        })
                      }
                      disabled={toggleProductField.isPending}
                      title={p.available ? 'موجود' : 'ناموجود'}
                    >
                      {p.available ? '✓' : '✗'}
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        toggleProductField.mutate({
                          id: p.id,
                          field: 'featured',
                          value: !p.featured,
                        })
                      }
                      disabled={toggleProductField.isPending}
                      title={p.featured ? 'پیشنهاد ویژه' : 'پیشنهاد ویژه نیست'}
                    >
                      ⭐
                    </button>
                    <button className="secondary" onClick={() => startEditProduct(p)}>
                      ویرایش
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        void deleteProduct(p.id);
                      }}
                      disabled={deleteProductMutation.isPending}
                    >
                      حذف
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

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

      {/* Batch actions bar */}
      {selectedProductIds.length > 0 && (
        <div className="batch-bar">
          <select
            value={batchAction}
            onChange={(e) => setBatchAction(e.target.value as 'move' | 'toggle' | 'delete' | '')}
          >
            <option value="">انتخاب عملیات...</option>
            <option value="move">انتقال به دسته‌بندی</option>
            <option value="toggle">تغییر وضعیت موجودی</option>
            <option value="delete">حذف</option>
          </select>
          {batchAction === 'move' && (
            <select value={batchTargetCatId} onChange={(e) => setBatchTargetCatId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {batchAction === 'toggle' && (
            <select value={batchToggleValue} onChange={(e) => setBatchToggleValue(e.target.value)}>
              <option value="true">موجود</option>
              <option value="false">ناموجود</option>
            </select>
          )}
          <button
            className="primary"
            onClick={() => {
              void handleBatchExecute();
            }}
            disabled={batchMutation.isPending}
          >
            {batchMutation.isPending ? '⏳...' : `اعمال روی ${selectedProductIds.length} محصول`}
          </button>
        </div>
      )}
    </>
  );
}
