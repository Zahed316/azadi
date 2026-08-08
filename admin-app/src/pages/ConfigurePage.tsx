import SettingsPage from './SettingsPage';
import MenuConfigPage from './MenuConfigPage';
import AdminsPage from './AdminsPage';

export default function ConfigurePage() {
  return (
    <>
      <div className="card">
        <h2>⚙️ Settings</h2>
        <SettingsPage />
      </div>
      <div className="card">
        <h2>📋 Menu Config</h2>
        <MenuConfigPage />
      </div>
      <div className="card">
        <h2>👥 Admins</h2>
        <AdminsPage />
      </div>
    </>
  );
}
