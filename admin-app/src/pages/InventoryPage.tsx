import { useState, useCallback, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoadingScreen from '../components/Spinner';

type SubTab = 'categories' | 'products';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'categories', label: '🏷️ دسته‌بندی‌ها' },
  { key: 'products', label: '📦 محصولات' },
];

const CategoriesSubTab = lazy(() => import('../components/CategoriesSubTab'));
const ProductsSubTab = lazy(() => import('../components/ProductsSubTab'));

export default function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SubTab) || 'categories';
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab);

  const switchTab = useCallback(
    (tab: SubTab) => {
      setActiveTab(tab);
      setSearchParams({ tab }, { replace: true });
    },
    [setSearchParams],
  );

  return (
    <>
      <div className="sub-tab-switcher" role="tablist" aria-label="زیربخش‌های موجودی">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`sub-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'categories' && (
        <div role="tabpanel">
          <Suspense fallback={<LoadingScreen />}>
            <CategoriesSubTab />
          </Suspense>
        </div>
      )}

      {activeTab === 'products' && (
        <div role="tabpanel">
          <Suspense fallback={<LoadingScreen />}>
            <ProductsSubTab />
          </Suspense>
        </div>
      )}
    </>
  );
}
