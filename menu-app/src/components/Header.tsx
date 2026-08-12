import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="header-wordmark">
        <span className="header-brand">آزادی</span>
        <span className="header-caption" dir="ltr">
          coffee roastery
        </span>
      </Link>
    </header>
  );
}
