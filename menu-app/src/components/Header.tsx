import { Link, useLocation } from 'react-router';

const navLinks = [
  { path: '/', label: 'خانه' },
  { path: '/featured', label: 'ویژه' },
  { path: '/seasonal', label: 'فصلی' },
  { path: '/branches', label: 'شعبه‌ها' },
  { path: '/faq', label: 'سؤالات' },
];

export default function Header() {
  const location = useLocation();

  return (
    <header className="site-header">
      <Link to="/" className="header-wordmark">
        <span className="header-brand">آزادی</span>
        <span className="header-caption" dir="ltr">
          coffee roastery
        </span>
      </Link>
      <nav className="header-nav">
        {navLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`header-nav-link ${location.pathname === link.path ? 'header-nav-link--active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
