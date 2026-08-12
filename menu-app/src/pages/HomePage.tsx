import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import { toPersianDigits } from '../utils/numbers';
import Spinner from '../components/Spinner';
import type { Category, Settings } from '../api/types';

export default function HomePage() {
  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<Category[]>('/categories', 'categories'),
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<Settings>('/settings', 'settings'),
  });

  if (catsLoading) return <Spinner />;

  const sorted = categories
    ? [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];

  return (
    <>
      {/* ── Dark hero ── */}
      <section className="hero">
        <p className="hero-eyebrow" dir="ltr">
          Coffee Roastery
        </p>
        <h1 className="hero-title">آزادی</h1>
        {settings?.about && <p className="hero-about">{settings.about}</p>}
        {settings?.instagram && (
          <a
            className="hero-instagram"
            href={settings.instagram}
            target="_blank"
            rel="noopener noreferrer"
          >
            اینستاگرام
          </a>
        )}
      </section>

      {/* ── Quick links ── */}
      <nav className="home-nav">
        <Link to="/featured" className="home-nav-link">
          ویژه
        </Link>
        <Link to="/seasonal" className="home-nav-link">
          فصلی
        </Link>
        <Link to="/branches" className="home-nav-link">
          شعبه‌ها
        </Link>
        <Link to="/faq" className="home-nav-link">
          سؤالات
        </Link>
      </nav>

      {/* ── Numbered category index ── */}
      <section className="category-index">
        <h2 className="category-index-title">منوی ما</h2>
        {sorted.length > 0 ? (
          <ul className="category-list">
            {sorted.map((cat, i) => (
              <li key={cat.id}>
                <Link to={`/category/${cat.id}`} className="category-row">
                  <span className="category-num">
                    {toPersianDigits(String(i + 1).padStart(2, '0'))}
                  </span>
                  <span className="category-name">{cat.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">دسته‌ای یافت نشد</div>
        )}
      </section>
    </>
  );
}
