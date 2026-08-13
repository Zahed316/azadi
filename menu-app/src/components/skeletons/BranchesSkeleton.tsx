import Skeleton from '../Skeleton';

export default function BranchesSkeleton() {
  return (
    <>
      <Skeleton width="80px" height="14px" borderRadius="var(--radius-md)" />
      <Skeleton width="120px" height="24px" borderRadius="var(--radius-md)" />
      {[1, 2].map((i) => (
        <div key={i} className="branch-row">
          <Skeleton width={`${100 + i * 40}px`} height="18px" borderRadius="var(--radius-sm)" />
          <Skeleton width="90%" height="14px" borderRadius="var(--radius-sm)" />
          <Skeleton width="40%" height="14px" borderRadius="var(--radius-sm)" />
        </div>
      ))}
    </>
  );
}
