import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type { Settings } from '../api/types';

export default function Footer() {
  const { data: settings } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<Settings>('/settings', 'settings'),
  });

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand" dir="ltr">
          <span className="footer-wordmark">AZADI</span>
          <span className="footer-tagline">coffee roastery</span>
        </div>

        <nav className="footer-nav">
          <Link to="/branches">شعبه‌ها</Link>
          <Link to="/faq">سؤالات متداول</Link>
          {settings?.instagram && (
            <a href={settings.instagram} target="_blank" rel="noopener noreferrer">
              اینستاگرام
            </a>
          )}
        </nav>

        <p className="footer-copy">© {new Date().getFullYear()} آزادی کافی رستری · ایرانشهر</p>
      </div>
    </footer>
  );
}
