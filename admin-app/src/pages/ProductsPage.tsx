import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import { ProductSkeleton } from '../components/SkeletonLoader';

export default function ProductsPage() {
  const { isSuperAdmin, allowedCatId, setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: queryKeys.products,
    queryFn: () => apiFetch<{ products: any[] }>('/products').then((r) => r.products),
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<{ categories: any[] }>('/categories').then((r) => r.categories),
  });

  // Batch
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [batchAction, setBatchAction] = useState<'move' | 'toggle' | 'delete' | ''>('');
  const [batchTargetCatId, setBatchTargetCatId] = useState('');
  const [batchToggleValue, setBatchToggleValue] = useState('true');

  // Editing
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCatId, setFilterCatId] = useState('');

  // Collapsible form sections
  const [showNutrition, setShowNutrition] = useState(false);
  const [showCoffeeDetails, setShowCoffeeDetails] = useState(false);

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

  // Coffee Details
  const [isCoffeeBean, setIsCoffeeBean] = useState(false);
  const [coffeeOrigin, setCoffeeOrigin] = useState('');
  const [coffeeFarm, setCoffeeFarm] = useState('');
  const [coffeeAltitude, setCoffeeAltitude] = useState('');
  const [coffeeProcessing, setCoffeeProcessing] = useState('');
  const [coffeeVariety, setCoffeeVariety] = useState('');
  const [coffeeRoastLevel, setCoffeeRoastLevel] = useState('');
  const [coffeeFlavorNotes, setCoffeeFlavorNotes] = useState('');
  const [coffeeRecommendedBrew, setCoffeeRecommendedBrew] = useState('');
  const [coffeeAcidity, setCoffeeAcidity] = useState('');
  const [coffeeBody, setCoffeeBody] = useState('');
  const [coffeeBrewGuide, setCoffeeBrewGuide] = useState('');

  // Nutritional info
  const [prodCalories, setProdCalories] = useState('');
  const [prodAllergens, setProdAllergens] = useState('');
  const [prodCaffeine, setProdCaffeine] = useState('');

  // Image URL
  const [prodImageUrl, setProdImageUrl] = useState('');

  const buildCoffeeDetails = () => {
    if (!isCoffeeBean) return null;
    const details: Record<string, string | null> = {};
    const fields = [
      ['origin', coffeeOrigin],
      ['farm', coffeeFarm],
      ['altitude', coffeeAltitude],
      ['processing', coffeeProcessing],
      ['variety', coffeeVariety],
      ['roastLevel', coffeeRoastLevel],
      ['flavorNotes', coffeeFlavorNotes],
      ['recommendedBrew', coffeeRecommendedBrew],
      ['acidity', coffeeAcidity],
      ['body', coffeeBody],
      ['brewGuide', coffeeBrewGuide],
    ] as const;
    for (const [key, val] of fields) {
      details[key] = val || null;
    }
    return details;
  };

  const removeImage = async (productId: number) => {
    try {
      await apiFetch(`/products/${productId}/image`, { method: 'DELETE' });
      setProdImageUrl('');
      showToast('تصویر حذف شد');
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
    } catch (err: any) {
      setError(err.message);
      showToast(err.message, 'error');
    }
  };

  const batchMutation = useMutation({
    mutationFn: (data: { ids: number[]; action: string; updateData?: any }) =>
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

  const saveProductMutation = useMutation({
    mutationFn: async (data: {
      method: string;
      id?: number;
      body: any;
      imageUrl?: string | null;
    }) => {
      // Save the product
      const result = await apiFetch<{ success: boolean }>(
        data.id ? `/products/${data.id}` : '/products',
        {
          method: data.method,
          body: data.body,
        },
      );
      // If editing and image URL changed, update it via the image endpoint
      if (data.id && data.imageUrl !== undefined) {
        if (data.imageUrl) {
          await apiFetch(`/products/${data.id}/image`, {
            method: 'PUT',
            body: { imageUrl: data.imageUrl },
          });
        } else if (data.body.imageUrl === null) {
          // imageUrl explicitly set to null means remove it
          await apiFetch(`/products/${data.id}/image`, { method: 'DELETE' });
        }
      }
      return result;
    },
    onSuccess: async (_, variables) => {
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
      queryClient.setQueryData(queryKeys.products, (old: any[] | undefined) =>
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

  if (isLoading) return <ProductSkeleton />;

  const toggleProductSelect = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Client-side search and category filter
  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = !filterCatId || p.categoryId?.toString() === filterCatId;
    return matchesSearch && matchesCat;
  });

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
        calories: prodCalories ? parseInt(prodCalories) : null,
        allergens: prodAllergens || null,
        caffeineMg: prodCaffeine ? parseInt(prodCaffeine) : null,
        coffeeDetails: buildCoffeeDetails(),
        imageUrl: prodImageUrl || null,
      },
      imageUrl: editingProduct?.id ? prodImageUrl || null : undefined,
    });
  };

  const deleteProduct = async (id: number) => {
    if (!(await confirm('مطمئن هستید این محصول حذف شود؟'))) return;
    deleteProductMutation.mutate(id);
  };

  const startEditProduct = (p: any) => {
    setEditingProduct(p);
    setProdImageUrl(p.imageUrl || '');
    setProdName(p.name);
    setProdPrice(p.price?.toString() || '');
    setProdStock(p.stock?.toString() || '0');
    setProdCatId(p.categoryId?.toString() || '');
    setProdDesc(p.description || '');
    setProdAvailable(p.available);
    setProdFeatured(p.featured ?? false);
    setProdSeasonal(p.isSeasonal ?? false);
    setProdUnit(p.unit || 'item');
    setProdPriceOnRequest(p.priceOnRequest ?? false);
    setProdSizeOptions(p.sizeOptions || '');
    setProdSyrupOptions(p.syrupOptions || '');
    setProdCalories(p.calories?.toString() || '');
    setProdAllergens(p.allergens || '');
    setProdCaffeine(p.caffeineMg?.toString() || '');
    const cd = p.coffee_details;
    setIsCoffeeBean(!!cd);
    setCoffeeOrigin(cd?.origin || '');
    setCoffeeFarm(cd?.farm || '');
    setCoffeeAltitude(cd?.altitude || '');
    setCoffeeProcessing(cd?.processing || '');
    setCoffeeVariety(cd?.variety || '');
    setCoffeeRoastLevel(cd?.roastLevel || '');
    setCoffeeFlavorNotes(cd?.flavorNotes || '');
    setCoffeeRecommendedBrew(cd?.recommendedBrew || '');
    setCoffeeAcidity(cd?.acidity || '');
    setCoffeeBody(cd?.body || '');
    setCoffeeBrewGuide(cd?.brewGuide || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setProdName('');
    setProdPrice('');
    setProdStock('');
    setProdDesc('');
    setProdAvailable(true);
    setProdFeatured(false);
    setProdSeasonal(false);
    setProdUnit('item');
    setProdPriceOnRequest(false);
    setProdSizeOptions('');
    setProdSyrupOptions('');
    setProdImageUrl('');
    setIsCoffeeBean(false);
    setCoffeeOrigin('');
    setCoffeeFarm('');
    setCoffeeAltitude('');
    setCoffeeProcessing('');
    setCoffeeVariety('');
    setCoffeeRoastLevel('');
    setCoffeeFlavorNotes('');
    setCoffeeRecommendedBrew('');
    setCoffeeAcidity('');
    setCoffeeBody('');
    setCoffeeBrewGuide('');
    setProdCalories('');
    setProdAllergens('');
    setProdCaffeine('');
  };

  return (
    <>
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

            <div className="section-divider">تصویر محصول</div>
            {editingProduct?.imageUrl && !prodImageUrl && (
              <div style={{ marginBottom: '8px' }}>
                <img
                  src={editingProduct.imageUrl}
                  alt="Product"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                />
                <button
                  type="button"
                  className="danger"
                  style={{ marginLeft: '8px' }}
                  onClick={() => removeImage(editingProduct.id)}
                >
                  حذف
                </button>
              </div>
            )}
            {prodImageUrl && (
              <div style={{ marginBottom: '8px' }}>
                <img
                  src={prodImageUrl}
                  alt="Preview"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <Field label="آدرس تصویر">
              <input
                value={prodImageUrl}
                onChange={(e) => setProdImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                dir="auto"
              />
            </Field>
            {prodImageUrl && (
              <div style={{ marginBottom: 8 }}>
                <a
                  href={prodImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.85em', color: '#4a90d9' }}
                >
                  🔗 پیش‌نمایش تصویر در تب جدید
                </a>
              </div>
            )}

            <div
              className="section-divider"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowNutrition(!showNutrition)}
            >
              {showNutrition ? '▼' : '▶'} اطلاعات تغذیه‌ای
            </div>
            {showNutrition && (
              <>
            <Field label="کالری (کیلوکالری)">
              <input
                type="number"
                value={prodCalories}
                onChange={(e) => setProdCalories(e.target.value)}
                placeholder="مثلاً ۱۲۰"
              />
            </Field>
            <Field label="کافئین (میلی‌گرم)">
              <input
                type="number"
                value={prodCaffeine}
                onChange={(e) => setProdCaffeine(e.target.value)}
                placeholder="مثلاً ۶۳"
              />
            </Field>
            <Field label="آلرژن‌ها">
              <input
                value={prodAllergens}
                onChange={(e) => setProdAllergens(e.target.value)}
                placeholder="مثلاً شیر، گلوتن"
                dir="auto"
              />
            </Field>
              </>
            )}

            <div
              className="section-divider"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowCoffeeDetails(!showCoffeeDetails)}
            >
              {showCoffeeDetails ? '▼' : '▶'} جزئیات قهوه (اختیاری)
            </div>
            {showCoffeeDetails && (
            <>
            <Field label="دانه قهوه است؟">
              <input
                type="checkbox"
                checked={isCoffeeBean}
                onChange={(e) => setIsCoffeeBean(e.target.checked)}
              />
            </Field>
            {isCoffeeBean && (
              <>
                <Field label="خاستگاه">
                  <input value={coffeeOrigin} onChange={(e) => setCoffeeOrigin(e.target.value)} />
                </Field>
                <Field label="مزرعه">
                  <input value={coffeeFarm} onChange={(e) => setCoffeeFarm(e.target.value)} />
                </Field>
                <Field label="ارتفاع">
                  <input
                    value={coffeeAltitude}
                    onChange={(e) => setCoffeeAltitude(e.target.value)}
                  />
                </Field>
                <Field label="فرآوری">
                  <input
                    value={coffeeProcessing}
                    onChange={(e) => setCoffeeProcessing(e.target.value)}
                  />
                </Field>
                <Field label="رقم">
                  <input value={coffeeVariety} onChange={(e) => setCoffeeVariety(e.target.value)} />
                </Field>
                <Field label="درجه رست">
                  <input
                    value={coffeeRoastLevel}
                    onChange={(e) => setCoffeeRoastLevel(e.target.value)}
                  />
                </Field>
                <Field label="نت‌های طعمی">
                  <input
                    value={coffeeFlavorNotes}
                    onChange={(e) => setCoffeeFlavorNotes(e.target.value)}
                  />
                </Field>
                <Field label="دم‌آوری پیشنهادی">
                  <input
                    value={coffeeRecommendedBrew}
                    onChange={(e) => setCoffeeRecommendedBrew(e.target.value)}
                  />
                </Field>
                <Field label="اسیدیته">
                  <input value={coffeeAcidity} onChange={(e) => setCoffeeAcidity(e.target.value)} />
                </Field>
                <Field label="بدنه">
                  <input value={coffeeBody} onChange={(e) => setCoffeeBody(e.target.value)} />
                </Field>
                <Field label="راهنمای دم‌آوری">
                  <textarea
                    value={coffeeBrewGuide}
                    onChange={(e) => setCoffeeBrewGuide(e.target.value)}
                    placeholder="دستورالعمل دم‌آوری را به فارسی بنویسید"
                    dir="auto"
                  />
                </Field>
              </>
            )}
            </>
            )}
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

      <div className="card">
        <h2>محصولات</h2>
        {products.length === 0 ? (
          <EmptyState message="هنوز محصولی وجود ندارد. برای شروع اولین محصول را اضافه کنید." />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="جستجوی نام محصول..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: 150 }}
                dir="auto"
              />
              <select value={filterCatId} onChange={(e) => setFilterCatId(e.target.value)}>
                <option value="">همه دسته‌بندی‌ها</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {filteredProducts.length === 0 ? (
              <EmptyState message="محصولی با فیلتر انتخاب‌شده یافت نشد." />
            ) : (
            <ul className="list">
              {filteredProducts.map((p) => (
              <li key={p.id} className="list-item">
                <div className="list-item-info">
                  {(isSuperAdmin || allowedCatId) && (
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => toggleProductSelect(p.id)}
                    />
                  )}
                  <span dir="auto">{p.name}</span>
                  {p.featured && <span title="پیشنهاد ویژه">⭐</span>}
                  {p.isSeasonal && <span title="مخصوص فصل">🌿</span>}
                  <span className="list-item-meta">
                    {p.price}
                    {p.unit && p.unit !== 'item' && (
                      <span style={{ marginLeft: 4, fontSize: '0.85em', opacity: 0.7 }}>
                        /{p.unit}
                      </span>
                    )}
                  </span>
                  {(p.calories || p.caffeineMg) && (
                    <span className="list-item-meta" style={{ fontSize: '0.8em' }}>
                      {p.calories ? `${p.calories} کیلوکالری` : ''}
                      {p.calories && p.caffeineMg ? ' · ' : ''}
                      {p.caffeineMg ? `${p.caffeineMg} میلی‌گرم کافئین` : ''}
                    </span>
                  )}
                </div>
                {(isSuperAdmin || allowedCatId) && (
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
                    <button
                      className="secondary"
                      onClick={() =>
                        toggleProductField.mutate({
                          id: p.id,
                          field: 'isSeasonal',
                          value: !p.isSeasonal,
                        })
                      }
                      disabled={toggleProductField.isPending}
                      title={p.isSeasonal ? 'مخصوص فصل' : 'مخصوص فصل نیست'}
                    >
                      🌿
                    </button>
                    <button className="secondary" onClick={() => startEditProduct(p)}>
                      ویرایش
                    </button>
                    <button
                      className="danger"
                      onClick={() => deleteProduct(p.id)}
                      disabled={deleteProductMutation.isPending}
                    >
                      حذف
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          )}
          </>
        )}
      </div>

      {selectedProductIds.length > 0 && (
        <div className="batch-bar">
          <select value={batchAction} onChange={(e) => setBatchAction(e.target.value as any)}>
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
            onClick={handleBatchExecute}
            disabled={batchMutation.isPending}
          >
            {batchMutation.isPending ? '⏳...' : `اعمال روی ${selectedProductIds.length} محصول`}
          </button>
        </div>
      )}
    </>
  );
}
