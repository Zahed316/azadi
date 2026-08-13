import Skeleton from '../Skeleton';

export default function FaqSkeleton() {
  return (
    <>
      <Skeleton width="80px" height="14px" borderRadius="var(--radius-md)" />
      <Skeleton width="180px" height="24px" borderRadius="var(--radius-md)" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="faq-row">
          <Skeleton width={`${140 + i * 30}px`} height="16px" borderRadius="var(--radius-sm)" />
          <Skeleton width="95%" height="14px" borderRadius="var(--radius-sm)" />
          <Skeleton width="70%" height="14px" borderRadius="var(--radius-sm)" />
        </div>
      ))}
    </>
  );
}
