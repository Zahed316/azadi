import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import FaqSkeleton from '../components/skeletons/FaqSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import type { FaqItem } from '../api/types';

export default function FaqPage() {
  const queryClient = useQueryClient();

  const {
    data: faqs,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.faq,
    queryFn: () => apiFetch<FaqItem[]>('/faq', 'faqs'),
  });

  if (isLoading) return <FaqSkeleton />;
  if (isError)
    return (
      <ErrorState
        message="خطا در بارگذاری سؤالات"
        detail={error?.message}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.faq });
        }}
      />
    );

  return (
    <>
      <Link to="/" className="back-link">
        بازگشت
      </Link>
      <div className="page-header">
        <h2 className="page-header-title">سؤالات متداول</h2>
      </div>
      {faqs?.length ? (
        <ol className="faq-list">
          {faqs.map((f) => (
            <li key={f.id} className="faq-row">
              <div className="faq-row-q">{f.question}</div>
              <div className="faq-row-a">{f.answer}</div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState message="سؤالی یافت نشد" detail="هنوز سؤالی ثبت نشده است" />
      )}
    </>
  );
}
