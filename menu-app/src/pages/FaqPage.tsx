import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Spinner from '../components/Spinner';
import type { FaqItem } from '../api/types';

export default function FaqPage() {
  const { data: faqs, isLoading } = useQuery({
    queryKey: queryKeys.faq,
    queryFn: () => apiFetch<FaqItem[]>('/faq', 'faqs'),
  });

  if (isLoading) return <Spinner />;

  return (
    <>
      <Link to="/" className="back-link">بازگشت</Link>
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
        <div className="empty-state">سؤالی یافت نشد</div>
      )}
    </>
  );
}
