import AboutUsPage from './AboutUsPage';
import ContentPage from './ContentPage';
import { MessagesPage } from './MessagesPage';

export default function InfoPage() {
  return (
    <>
      <div className="card">
        <h2>🏠 درباره ما</h2>
        <AboutUsPage />
      </div>
      <div className="card">
        <h2>📝 محتوا (سوالات متداول)</h2>
        <ContentPage />
      </div>
      <div className="card">
        <h2>✉️ پیام‌ها</h2>
        <MessagesPage />
      </div>
    </>
  );
}
