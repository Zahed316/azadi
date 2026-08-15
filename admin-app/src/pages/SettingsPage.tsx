import ConfigurePage from './ConfigurePage';
import InfoPage from './InfoPage';

export default function SettingsPage() {
  return (
    <>
      <ConfigurePage />
      <div style={{ marginTop: 24 }} />
      <InfoPage />
    </>
  );
}
