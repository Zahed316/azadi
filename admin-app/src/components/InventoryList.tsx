import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type {
  ProductsResponse,
  CategoriesResponse,
  BranchesResponse,
  ProductRow,
} from '../api/types';
import { useToggleProductField, useSaveProduct } from '../hooks/useProductMutations';
import { useTelegramHaptics } from '../hooks/useTelegramHaptics';
import { useAppContext } from '../AppContext';
import EmptyState from './EmptyState';
import { ProductSkeleton } from './SkeletonLoader';
import { SegmentedControl } from './SegmentedControl';
import BranchSelector from './BranchSelector';
import InlineStockEditor from './InlineStockEditor';
import ProductFormDrawer from './ProductFormDrawer';
import type { ProductFormData } from './ProductFormDrawer';

export default function InventoryList() {
  const { isSuperAdmin, allowedCatId, setError, showToast, confirm } = useAppContext();
  const haptics = useTelegramHaptics();
  const queryClient = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────
  const { data: products = [], isLoading } = useQuery({
    queryKey: queryKeys.products,
    queryFn: () => apiFetch<ProductsResponse>('/products').then((r) => r.products),
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<CategoriesResponse>('/categories').then((r) => r.categories),
  });

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiFetch<BranchesResponse>('/branches').then((r) => r.branches),
    enabled: isSuperAdmin,
  });

  // ── Filters ───────────────────────────────────────────────────────
  const [filterCatId, setFilterCatId] = useState<number | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterCatId !== null && p.categoryId !== filterCatId) return false;
      if (isSuperAdmin && branchId !== null && p.branchId !== branchId) return false;
      if (!isSuperAdmin && allowedCatId && p.categoryId !== allowedCatId) return false;
      return true;
    });
  }, [products, filterCatId, branchId, isSuperAdmin, allowedCatId]);

  // ── Mutations ─────────────────────────────────────────────────────
  const toggleProductField = useToggleProductField();

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

  const deleteProduct = async (id: number) => {
    if (!(await confirm('مطمئن هستید این محصول حذف شود؟'))) return;
    deleteProductMutation.mutate(id);
  };

  // ── Editing drawer ──────────────────────────────────────────────────
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  const saveProductMutation = useSaveProduct({
    onSuccess: (msg) => {
      setEditingProduct(null);
      showToast(msg);
    },
    onError: (msg) => {
      setError(msg);
      showToast(msg, 'error');
    },
  });

  const handleDrawerSubmit = (data: ProductFormData) => {
    saveProductMutation.mutate({
      method: editingProduct ? 'PUT' : 'POST',
      id: editingProduct?.id,
      body: data,
      imageUrl: editingProduct?.id ? data.imageUrl : undefined,
    });
  };

  // ── Batch ─────────────────────────────────────────────────────────
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [batchAction, setBatchAction] = useState<'move' | 'toggle' | 'delete' | ''>('');
  const [batchTargetCatId, setBatchTargetCatId] = useState('');
  const [batchToggleValue, setBatchToggleValue] = useState('true');

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

  const toggleProductSelect = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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

  // ── Render ────────────────────────────────────────────────────────
  if (isLoading) return <ProductSkeleton />;

  return (
    <>
      {/* Branch selector (super_admin only) */}
      {isSuperAdmin && branches.length > 0 && (
        <BranchSelector branches={branches} selectedId={branchId} onChange={setBranchId} />
      )}

      {/* Category filter chips */}
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

      {/* Add product button (opens drawer in create mode) */}
      {(isSuperAdmin || allowedCatId) && (
        <button
          type="button"
          className="primary"
          style={{ marginBottom: 12 }}
          onClick={() => setEditingProduct(null)}
        >
          + افزودن محصول
        </button>
      )}

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
                  <button
                    type="button"
                    className="product-name-btn"
                    onClick={() => setEditingProduct(p)}
                  >
                    <span dir="auto">{p.name}</span>
                  </button>
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
                <span className="list-item-meta" style={{ fontSize: '0.85em' }}>
                  {p.category_name}
                </span>
              </div>

              {/* Inline stock editor (hidden for cup units) */}
              {p.unit !== 'cup' && (
                <InlineStockEditor
                  value={p.stock}
                  onChange={(newStock) =>
                    toggleProductField.mutate({ id: p.id, field: 'stock', value: newStock })
                  }
                  onZero={() => {
                    toggleProductField.mutate({ id: p.id, field: 'stock', value: 0 });
                    toggleProductField.mutate({ id: p.id, field: 'available', value: false });
                    haptics.error();
                  }}
                />
              )}

              {/* Available toggle */}
              {(isSuperAdmin || allowedCatId) && (
                <SegmentedControl
                  options={[
                    { label: '✓', value: 'true' },
                    { label: '✗', value: 'false' },
                  ]}
                  value={p.available ? 'true' : 'false'}
                  onChange={(v) =>
                    toggleProductField.mutate({
                      id: p.id,
                      field: 'available',
                      value: v === 'true',
                    })
                  }
                />
              )}

              {/* Batch select + delete */}
              {(isSuperAdmin || allowedCatId) && (
                <>
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(p.id)}
                    onChange={() => toggleProductSelect(p.id)}
                  />
                  <button
                    className="danger"
                    onClick={() => {
                      void deleteProduct(p.id);
                    }}
                    disabled={deleteProductMutation.isPending}
                  >
                    حذف
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

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

      {/* Product form drawer (add/edit) */}
      <ProductFormDrawer
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSubmit={handleDrawerSubmit}
        isPending={saveProductMutation.isPending}
      />
    </>
  );
}
