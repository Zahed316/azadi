/** Shimmer skeleton placeholders for loading states. */

export function ProductSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-image" />
          <div className="skeleton-body">
            <div className="skeleton-text" />
            <div className="skeleton-text short" />
            <div className="skeleton-text tiny" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CategorySkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-avatar" />
          <div className="skeleton-content">
            <div className="skeleton-text" />
            <div className="skeleton-text short" />
          </div>
        </div>
      ))}
    </div>
  );
}
