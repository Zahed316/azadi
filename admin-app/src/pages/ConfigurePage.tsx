import SettingsForm from './SettingsForm';
import MenuConfigPage from './MenuConfigPage';
import AdminsPage from './AdminsPage';

export default function ConfigurePage() {
  return (
    <>
      <div className="card">
        <h2>⚙️ تنظیمات</h2>
        <SettingsForm />
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
