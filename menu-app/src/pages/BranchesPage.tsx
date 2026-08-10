import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Spinner from '../components/Spinner';
import type { Branch } from '../api/types';

export default function BranchesPage() {
  const { data: branches, isLoading } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiFetch<Branch[]>('/branches', 'branches'),
  });

  if (isLoading) return <Spinner />;

  return (
    <>
      <Link to="/" className="back-link">بازگشت</Link>
      <div className="page-header">
        <h2 className="page-header-title">شعب ما</h2>
      </div>
      {branches?.length ? (
        <div className="branch-list">
          {branches.map((b) => (
            <div key={b.id} className="branch-row">
              <h3 className="branch-row-name">{b.name}</h3>
              <div className="branch-row-detail">{b.address}</div>
              <div className="branch-row-detail" dir="ltr" style={{ textAlign: 'left' }}>{b.phone}</div>
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
        <div className="empty-state">شعبه‌ای یافت نشد</div>
      )}
    </>
  );
}
