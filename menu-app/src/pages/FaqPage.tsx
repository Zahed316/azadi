import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Spinner from '../components/Spinner';

interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

export default function FaqPage() {
  const { data: faqs, isLoading } = useQuery({
    queryKey: queryKeys.faq,
    queryFn: () => apiFetch<FaqItem[]>('/faq'),
  });

  if (isLoading) return <Spinner />;

  return (
    <>
      <Link to="/" className="back-link">بازگشت</Link>
      <h2 className="section-title">سوالات متداول</h2>
      {faqs?.map((f) => (
        <div key={f.id} className="faq-item">
          <div className="faq-question">{f.question}</div>
          <div className="faq-answer">{f.answer}</div>
        </div>
      ))}
      {!faqs?.length && <div className="empty-state">سوالی یافت نشد</div>}
    </>
  );
}
