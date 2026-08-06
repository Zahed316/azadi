import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch, apiUpload } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';

export default function ProductsPage() {
  const { isSuperAdmin, allowedCatId, setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
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

  // Form
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodCatId, setProdCatId] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);

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

  // Image
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;
    setProductImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = async (productId: number) => {
    try {
      await apiFetch(`/products/${productId}/image`, { method: 'DELETE' });
      setProductImage(null);
      setImagePreview('');
      showToast('Image removed');
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
      showToast('Batch action completed ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const saveProductMutation = useMutation({
    mutationFn: (data: { method: string; id?: number; body: any; image?: File | null }) =>
      apiFetch(data.id ? `/products/${data.id}` : '/products', {
        method: data.method,
        body: data.body,
      }),
    onSuccess: async (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      // Upload image if one was selected
      if (variables.image && variables.id) {
        try {
          await apiUpload(`/products/${variables.id}/image`, variables.image);
          showToast('Image uploaded');
          void queryClient.invalidateQueries({ queryKey: queryKeys.products });
        } catch (err: any) {
          setError(err.message);
          showToast(err.message, 'error');
        }
      } else if (variables.image && !variables.id) {
        // For new products, the API doesn't return the new ID in the response.
        // User can add image via Edit after creating the product.
        showToast('Product added. Add image via Edit.');
      }
      resetProductForm();
      showToast(variables.id ? 'Product updated ✓' : 'Product added ✓');
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
      showToast('Product deleted ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const toggleProductSelect = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleBatchExecute = async () => {
    if (!batchAction || selectedProductIds.length === 0) return;
    if (!(await confirm(`Apply action to ${selectedProductIds.length} products?`))) return;
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
        calories: prodCalories ? parseInt(prodCalories) : null,
        allergens: prodAllergens || null,
        caffeineMg: prodCaffeine ? parseInt(prodCaffeine) : null,
        coffeeDetails: buildCoffeeDetails(),
      },
      image: productImage,
    });
  };

  const deleteProduct = async (id: number) => {
    if (!(await confirm('Are you sure you want to delete this product?'))) return;
    deleteProductMutation.mutate(id);
  };

  const startEditProduct = (p: any) => {
    setEditingProduct(p);
    setProductImage(null);
    setImagePreview('');
    setProdName(p.name);
    setProdPrice(p.price?.toString() || '');
    setProdStock(p.stock?.toString() || '0');
    setProdCatId(p.categoryId?.toString() || '');
    setProdDesc(p.description || '');
    setProdAvailable(p.available);
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
    setProductImage(null);
    setImagePreview('');
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
          <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
          <form onSubmit={handleSaveProduct}>
            <Field label="Name">
              <input value={prodName} onChange={(e) => setProdName(e.target.value)} required />
            </Field>
            <Field label="Price">
              <input
                type="number"
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                required
              />
            </Field>
            <Field label="Stock">
              <input
                type="number"
                value={prodStock}
                onChange={(e) => setProdStock(e.target.value)}
                required
              />
            </Field>
            <Field label="Category">
              <select value={prodCatId} onChange={(e) => setProdCatId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <textarea value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} />
            </Field>
            <Field label="Available">
              <input
                type="checkbox"
                checked={prodAvailable}
                onChange={(e) => setProdAvailable(e.target.checked)}
              />
            </Field>

            <div className="section-divider">Product Image</div>
            {editingProduct?.imageUrl && !productImage && (
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
                  Remove
                </button>
              </div>
            )}
            {imagePreview && (
              <div style={{ marginBottom: '8px' }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                />
              </div>
            )}
            <Field label="Upload Image">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
              />
            </Field>

            <div className="section-divider">Nutritional Information</div>
            <Field label="Calories (kcal)">
              <input
                type="number"
                value={prodCalories}
                onChange={(e) => setProdCalories(e.target.value)}
                placeholder="e.g. 120"
              />
            </Field>
            <Field label="Caffeine (mg)">
              <input
                type="number"
                value={prodCaffeine}
                onChange={(e) => setProdCaffeine(e.target.value)}
                placeholder="e.g. 63"
              />
            </Field>
            <Field label="Allergens">
              <input
                value={prodAllergens}
                onChange={(e) => setProdAllergens(e.target.value)}
                placeholder="e.g. milk, gluten"
                dir="auto"
              />
            </Field>

            <div className="section-divider">Coffee Details (optional)</div>
            <Field label="Is Coffee Bean?">
              <input
                type="checkbox"
                checked={isCoffeeBean}
                onChange={(e) => setIsCoffeeBean(e.target.checked)}
              />
            </Field>
            {isCoffeeBean && (
              <>
                <Field label="Origin">
                  <input value={coffeeOrigin} onChange={(e) => setCoffeeOrigin(e.target.value)} />
                </Field>
                <Field label="Farm">
                  <input value={coffeeFarm} onChange={(e) => setCoffeeFarm(e.target.value)} />
                </Field>
                <Field label="Altitude">
                  <input
                    value={coffeeAltitude}
                    onChange={(e) => setCoffeeAltitude(e.target.value)}
                  />
                </Field>
                <Field label="Processing">
                  <input
                    value={coffeeProcessing}
                    onChange={(e) => setCoffeeProcessing(e.target.value)}
                  />
                </Field>
                <Field label="Variety">
                  <input value={coffeeVariety} onChange={(e) => setCoffeeVariety(e.target.value)} />
                </Field>
                <Field label="Roast Level">
                  <input
                    value={coffeeRoastLevel}
                    onChange={(e) => setCoffeeRoastLevel(e.target.value)}
                  />
                </Field>
                <Field label="Flavor Notes">
                  <input
                    value={coffeeFlavorNotes}
                    onChange={(e) => setCoffeeFlavorNotes(e.target.value)}
                  />
                </Field>
                <Field label="Recommended Brew">
                  <input
                    value={coffeeRecommendedBrew}
                    onChange={(e) => setCoffeeRecommendedBrew(e.target.value)}
                  />
                </Field>
                <Field label="Acidity">
                  <input value={coffeeAcidity} onChange={(e) => setCoffeeAcidity(e.target.value)} />
                </Field>
                <Field label="Body">
                  <input value={coffeeBody} onChange={(e) => setCoffeeBody(e.target.value)} />
                </Field>
                <Field label="Brew Guide">
                  <textarea
                    value={coffeeBrewGuide}
                    onChange={(e) => setCoffeeBrewGuide(e.target.value)}
                    placeholder="Brewing instructions in Persian"
                    dir="auto"
                  />
                </Field>
              </>
            )}
            <button type="submit" className="primary">
              {editingProduct ? 'Update' : 'Add'} Product
            </button>
            {editingProduct && (
              <button type="button" className="secondary" onClick={resetProductForm}>
                Cancel
              </button>
            )}
          </form>
        </div>
      )}

      <div className="card">
        <h2>Products</h2>
        {products.length === 0 ? (
          <EmptyState message="No products yet." />
        ) : (
          <ul className="list">
            {products.map((p) => (
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
                  <span className="list-item-meta">{p.price}</span>
                  {(p.calories || p.caffeineMg) && (
                    <span className="list-item-meta" style={{ fontSize: '0.8em' }}>
                      {p.calories ? `${p.calories} kcal` : ''}
                      {p.calories && p.caffeineMg ? ' · ' : ''}
                      {p.caffeineMg ? `${p.caffeineMg}mg caf` : ''}
                    </span>
                  )}
                </div>
                {(isSuperAdmin || allowedCatId) && (
                  <div className="list-item-actions">
                    <button className="secondary" onClick={() => startEditProduct(p)}>
                      Edit
                    </button>
                    <button className="danger" onClick={() => deleteProduct(p.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedProductIds.length > 0 && (
        <div className="batch-bar">
          <select value={batchAction} onChange={(e) => setBatchAction(e.target.value as any)}>
            <option value="">Select action...</option>
            <option value="move">Move to Category</option>
            <option value="toggle">Toggle Availability</option>
            <option value="delete">Delete</option>
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
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </select>
          )}
          <button className="primary" onClick={handleBatchExecute}>
            Apply to {selectedProductIds.length} products
          </button>
        </div>
      )}
    </>
  );
}
