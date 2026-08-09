import SettingsPage from './SettingsPage';
import MenuConfigPage from './MenuConfigPage';
import AdminsPage from './AdminsPage';

export default function ConfigurePage() {
  return (
    <>
      <div className="card">
        <h2>⚙️ تنظیمات</h2>
        <SettingsPage />
      </div>
      <div className="card">
        <h2>📋 تنظیمات منو</h2>
        <MenuConfigPage />
      </div>
      <div className="card">
        <h2>👥 ادمین‌ها</h2>
        <AdminsPage />
      </div>
    </>
  );
}
