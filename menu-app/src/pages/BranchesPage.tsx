import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Spinner from '../components/Spinner';

interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
  hours: string;
}

export default function BranchesPage() {
  const { data: branches, isLoading } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiFetch<Branch[]>('/branches', 'branches'),
  });

  if (isLoading) return <Spinner />;

  return (
    <>
      <Link to="/" className="back-link">بازگشت</Link>
      <h2 className="section-title">شعب ما</h2>
      {branches?.map((b) => (
        <div key={b.id} className="branch-card">
          <div className="branch-name">{b.name}</div>
          <div className="branch-detail">آدرس: {b.address}</div>
          <div className="branch-detail">تلفن: {b.phone}</div>
          <div className="branch-detail">ساعت: {b.hours}</div>
        </div>
      ))}
      {!branches?.length && <div className="empty-state">شعبه‌ای یافت نشد</div>}
    </>
  );
}
