import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import BranchesSkeleton from '../components/skeletons/BranchesSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import type { Branch } from '../api/types';

export default function BranchesPage() {
  const queryClient = useQueryClient();

  const {
    data: branches,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiFetch<Branch[]>('/branches', 'branches'),
  });

  if (isLoading) return <BranchesSkeleton />;
  if (isError)
    return (
      <ErrorState
        message="خطا در بارگذاری شعبه‌ها"
        detail={error?.message}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.branches });
        }}
      />
    );

  return (
    <>
      <Link to="/" className="back-link">
        بازگشت
      </Link>
      <div className="page-header">
        <h2 className="page-header-title">شعب ما</h2>
      </div>
      {branches?.length ? (
        <div className="branch-list">
          {branches.map((b) => (
            <div key={b.id} className="branch-row">
              <h3 className="branch-row-name">{b.name}</h3>
              <div className="branch-row-detail">{b.address}</div>
              <div className="branch-row-detail" dir="ltr" style={{ textAlign: 'left' }}>
                {b.phone}
              </div>
              <div className="branch-row-detail">{b.openingHours}</div>
              {b.location && (
                <a
                  className="branch-row-map"
                  href={b.location}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  مشاهده روی نقشه
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="شعبه‌ای یافت نشد" detail="هنوز شعبه‌ای ثبت نشده است" />
      )}
    </>
  );
}
