import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="header">
      <Link to="/" style={{ textDecoration: 'none' }}>
        <h1>ازادی کافه</h1>
      </Link>
    </header>
  );
}
