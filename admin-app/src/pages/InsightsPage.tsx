import AILogsPage from './AILogsPage';
import AITestPage from './AITestPage';

export default function InsightsPage() {
  return (
    <>
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
