import Skeleton from '../Skeleton';

export default function HomeSkeleton() {
  return (
    <>
      <div className="hero" style={{ padding: 'var(--space-2xl) var(--space-md)' }}>
        <Skeleton width="100px" height="12px" borderRadius="var(--radius-full)" />
        <Skeleton width="160px" height="42px" borderRadius="var(--radius-md)" />
        <Skeleton width="300px" height="16px" borderRadius="var(--radius-md)" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="category-row" style={{ pointerEvents: 'none' }}>
          <Skeleton width="24px" height="16px" borderRadius="var(--radius-sm)" />
          <Skeleton width={`${120 + i * 30}px`} height="18px" borderRadius="var(--radius-sm)" />
        </div>
      ))}
    </>
  );
}
