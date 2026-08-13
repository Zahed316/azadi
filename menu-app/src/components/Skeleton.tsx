interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

/**
 * Skeleton loading placeholder with shimmer animation.
 * Use during data fetching to show content structure before data arrives.
 */
export default function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-md)',
  className,
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className ?? ''}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}
