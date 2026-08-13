import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import { toPersianDigits } from '../utils/numbers';
import HomeSkeleton from '../components/skeletons/HomeSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import type { Category, Settings } from '../api/types';

export default function HomePage() {
  const queryClient = useQueryClient();

  const {
    data: categories,
    isLoading: catsLoading,
    isError: catsError,
    error: catsErr,
  } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<Category[]>('/categories', 'categories'),
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<Settings>('/settings', 'settings'),
  });

  if (catsLoading) return <HomeSkeleton />;
  if (catsError)
    return (
      <ErrorState
        message="خطا در بارگذاری منو"
        detail={catsErr?.message}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
        }}
      />
    );

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

      {/* ── Announcement banner ── */}
      {settings?.announcement && (
        <section className="announcement-banner" dir="auto">
          {settings.announcement}
        </section>
      )}

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
          <EmptyState message="دسته‌ای یافت نشد" detail="منو هنوز آماده نیست" />
        )}
      </section>
    </>
  );
}
