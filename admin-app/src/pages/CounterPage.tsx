import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type {
  ProductsResponse,
  CategoriesResponse,
  BranchesResponse,
  ProductRow,
} from '../api/types';
import { useToggleProductField } from '../hooks/useProductMutations';
import { useTelegramHaptics } from '../hooks/useTelegramHaptics';
import { useAppContext } from '../AppContext';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';
import { SegmentedControl } from '../components/SegmentedControl';
import BranchSelector from '../components/BranchSelector';
import InlineStockEditor from '../components/InlineStockEditor';
import Icon from '../components/Icon';

/**
 * Barista home screen (landing page for category_admin users).
 *
 * Shows products grouped by category with inline stock and availability
 * controls. Branch selector for multi-branch users, search overlay,
 * and per-product action sheet for hiding products.
 */
export default function CounterPage() {
  const { isSuperAdmin, allowedCatId, showToast } = useAppContext();
  const haptics = useTelegramHaptics();

  // ── Data ──────────────────────────────────────────────────────────
  const { data: products = [], isLoading: productsLoading } = useQuery({
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

  // ── State ─────────────────────────────────────────────────────────
  const [branchId, setBranchId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [actionSheetProductId, setActionSheetProductId] = useState<number | null>(null);

  // ── Filter + group ────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (isSuperAdmin && branchId !== null && p.branchId !== branchId) return false;
      if (!isSuperAdmin && allowedCatId && p.categoryId !== allowedCatId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.category_name != null && p.category_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, branchId, searchQuery, isSuperAdmin, allowedCatId]);

  const groupedProducts = useMemo(() => {
    const groups = new Map<number, ProductRow[]>();
    for (const p of filteredProducts) {
      const existing = groups.get(p.categoryId) || [];
      existing.push(p);
      groups.set(p.categoryId, existing);
    }
    return groups;
  }, [filteredProducts]);

  // ── Mutations ─────────────────────────────────────────────────────
  const toggleProductField = useToggleProductField();

  const handleHideProduct = useCallback(
    (productId: number) => {
      setActionSheetProductId(null);
      toggleProductField.mutate({ id: productId, field: 'available', value: false });
      haptics.success();
      showToast('محصول مخفی شد');
    },
    [toggleProductField, haptics, showToast],
  );

  // ── Search overlay ────────────────────────────────────────────────
  const openSearch = useCallback(() => {
    setSearchOpen(true);
    haptics.select();
  }, [haptics]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  // ── Render ────────────────────────────────────────────────────────
  if (productsLoading) return <LoadingScreen />;

  return (
    <div className="counter-page">
      {/* Header */}
      <div className="counter-header">
        <h2>پیشخوان</h2>
        <button
          type="button"
          className="counter-search-btn"
          onClick={openSearch}
          aria-label="جستجو"
        >
          <Icon name="search" size={20} />
        </button>
      </div>

      {/* Branch selector (super_admin only) */}
      {isSuperAdmin && branches.length > 0 && (
        <BranchSelector branches={branches} selectedId={branchId} onChange={setBranchId} />
      )}

      {/* Product groups */}
      {groupedProducts.size === 0 ? (
        <EmptyState message="محصولی یافت نشد." />
      ) : (
        Array.from(groupedProducts.entries()).map(([catId, items]) => {
          const category = categories.find((c) => c.id === catId);
          return (
            <div key={catId} className="counter-category">
              <h3 className="counter-category-header">
                {category?.emoji && (
                  <span className="counter-category-emoji">{category.emoji} </span>
                )}
                <span dir="auto">{category?.name || 'بدون دسته‌بندی'}</span>
              </h3>
              <div className="counter-products">
                {items.map((p) => (
                  <div key={p.id} className="counter-product">
                    <div className="counter-product-info">
                      <span className="counter-product-name" dir="auto">
                        {p.name}
                      </span>
                      {p.featured && (
                        <span className="counter-product-badge" title="پیشنهاد ویژه">
                          ⭐
                        </span>
                      )}
                      {p.isSeasonal && (
                        <span className="counter-product-badge" title="مخصوص فصل">
                          🌿
                        </span>
                      )}
                    </div>
                    <div className="counter-product-controls">
                      {/* Stock editor (hidden for cup units) */}
                      {p.unit !== 'cup' && (
                        <InlineStockEditor
                          value={p.stock}
                          onChange={(newStock) =>
                            toggleProductField.mutate({
                              id: p.id,
                              field: 'stock',
                              value: newStock,
                            })
                          }
                          onZero={() => {
                            toggleProductField.mutate({ id: p.id, field: 'stock', value: 0 });
                            toggleProductField.mutate({
                              id: p.id,
                              field: 'available',
                              value: false,
                            });
                            haptics.error();
                          }}
                        />
                      )}

                      {/* Available toggle */}
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

                      {/* Action button */}
                      <button
                        type="button"
                        className="counter-product-action"
                        onClick={() => setActionSheetProductId(p.id)}
                        aria-label="گزینه‌ها"
                      >
                        <Icon name="menu" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Search overlay */}
      {searchOpen && (
        <div
          className="counter-search-overlay"
          onClick={closeSearch}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeSearch();
          }}
          role="dialog"
          aria-label="جستجو"
        >
          <div className="counter-search-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="counter-search-header">
              <input
                type="text"
                className="counter-search-input"
                placeholder="نام محصول یا دسته‌بندی..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                dir="auto"
              />
              <button
                type="button"
                className="counter-search-close"
                onClick={closeSearch}
                aria-label="بستن"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action sheet */}
      {actionSheetProductId !== null && (
        <div
          className="counter-search-overlay"
          onClick={() => setActionSheetProductId(null)}
          role="dialog"
          aria-label="گزینه‌ها"
        >
          <div className="counter-action-sheet" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="counter-action-sheet-item danger"
              onClick={() => handleHideProduct(actionSheetProductId)}
            >
              مخفی کردن محصول
            </button>
            <button
              type="button"
              className="counter-action-sheet-item"
              onClick={() => setActionSheetProductId(null)}
            >
              انصراف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
