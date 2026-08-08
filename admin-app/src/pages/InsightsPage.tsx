import StreaksPage from './StreaksPage';
import FavoritesPage from './FavoritesPage';
import AILogsPage from './AILogsPage';
import AITestPage from './AITestPage';

export default function InsightsPage() {
  return (
    <>
      <div className="card">
        <h2>🔥 Streaks</h2>
        <StreaksPage />
      </div>
      <div className="card">
        <h2>⭐ Favorites</h2>
        <FavoritesPage />
      </div>
      <div className="card">
        <h2>🤖 AI Logs</h2>
        <AILogsPage />
      </div>
      <div className="card">
        <h2>🧪 AI Test</h2>
        <AITestPage />
      </div>
    </>
  );
}
