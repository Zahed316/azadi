import Skeleton from '../Skeleton';

export default function CategorySkeleton() {
  return (
    <>
      <Skeleton width="80px" height="14px" borderRadius="var(--radius-md)" />
      <Skeleton width="200px" height="24px" borderRadius="var(--radius-md)" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="product-row" style={{ pointerEvents: 'none' }}>
          <Skeleton width="56px" height="56px" borderRadius="6px" />
          <div style={{ flex: 1 }}>
            <Skeleton width={`${100 + i * 20}px`} height="16px" borderRadius="var(--radius-sm)" />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: '4px' }}>
              <Skeleton width="100%" height="12px" borderRadius="var(--radius-sm)" />
              <Skeleton width="60px" height="12px" borderRadius="var(--radius-sm)" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
