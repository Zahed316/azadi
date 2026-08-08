import AboutUsPage from './AboutUsPage';
import ContentPage from './ContentPage';
import { MessagesPage } from './MessagesPage';

export default function InfoPage() {
  return (
    <>
      <div className="card">
        <h2>🏠 About Us</h2>
        <AboutUsPage />
      </div>
      <div className="card">
        <h2>📝 Content (FAQ)</h2>
        <ContentPage />
      </div>
      <div className="card">
        <h2>✉️ Messages</h2>
        <MessagesPage />
      </div>
    </>
  );
}
