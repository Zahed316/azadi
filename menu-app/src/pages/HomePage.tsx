import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Spinner from '../components/Spinner';

interface Category {
  id: number;
  name: string;
  emoji: string;
}

export default function HomePage() {
  const { data: categories, isLoading } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<Category[]>('/categories'),
  });

  if (isLoading) return <Spinner />;

  return (
    <>
      <h2 className="section-title">منوی ما</h2>
      <div className="nav-links">
        <Link to="/featured" className="nav-link">⭐ ویژه</Link>
        <Link to="/seasonal" className="nav-link"> فصلی</Link>
        <Link to="/branches" className="nav-link"> شعب</Link>
        <Link to="/faq" className="nav-link"> سوالات</Link>
      </div>
      <div className="grid">
        {categories?.map((cat) => (
          <Link key={cat.id} to={`/category/${cat.id}`} className="grid-item">
            <div className="grid-emoji">{cat.emoji}</div>
            <div className="grid-label">{cat.name}</div>
          </Link>
        ))}
      </div>
      {!categories?.length && <div className="empty-state">دسته‌ای یافت نشد</div>}
    </>
  );
}
