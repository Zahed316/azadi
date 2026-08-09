import StreaksPage from './StreaksPage';
import FavoritesPage from './FavoritesPage';
import AILogsPage from './AILogsPage';
import AITestPage from './AITestPage';

export default function InsightsPage() {
  return (
    <>
      <div className="card">
        <h2>🔥 استریک‌ها</h2>
        <StreaksPage />
      </div>
      <div className="card">
        <h2>⭐ موارد محبوب</h2>
        <FavoritesPage />
      </div>
      <div className="card">
        <h2>🤖 گزارش‌های هوش مصنوعی</h2>
        <AILogsPage />
      </div>
      <div className="card">
        <h2>🧪 تست هوش مصنوعی</h2>
        <AITestPage />
      </div>
    </>
  );
}
