import Skeleton from '../Skeleton';

export default function ProductSkeleton() {
  return (
    <>
      <Skeleton width="80px" height="14px" borderRadius="var(--radius-md)" />
      <Skeleton width="100%" height="280px" borderRadius="0" />
      <div style={{ padding: 'var(--space-lg) 0 var(--space-sm)' }}>
        <Skeleton width="60%" height="28px" borderRadius="var(--radius-md)" />
      </div>
      <Skeleton width="40%" height="14px" borderRadius="var(--radius-sm)" />
      <div style={{ display: 'flex', gap: 'var(--space-sm)', padding: 'var(--space-md) 0' }}>
        <Skeleton width="100%" height="14px" borderRadius="var(--radius-sm)" />
        <Skeleton width="80px" height="14px" borderRadius="var(--radius-sm)" />
      </div>
      <Skeleton width="100%" height="80px" borderRadius="var(--radius-md)" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-xs) 0' }}
        >
          <Skeleton width="60px" height="13px" borderRadius="var(--radius-sm)" />
          <Skeleton width={`${80 + i * 15}px`} height="14px" borderRadius="var(--radius-sm)" />
        </div>
      ))}
    </>
  );
}
