import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';

const MENU_VISIBILITY_KEYS = [
  'menu_visible_featured',
  'menu_visible_seasonal',
  'menu_visible_passport',
  'menu_visible_search',
  'menu_visible_favorites',
  'menu_visible_about',
  'menu_visible_drinks',
  'menu_visible_beans',
  'menu_visible_cakes',
  'menu_visible_branches',
  'menu_visible_faq',
] as const;

const MENU_VISIBILITY_LABELS: Record<string, string> = {
  menu_visible_featured: '⭐ Featured (پیشنهاد ویژه)',
  menu_visible_seasonal: '🌿 Seasonal (مخصوص فصل)',
  menu_visible_passport: '📖 Coffee Passport (پاسپورت قهوه)',
  menu_visible_search: '🔍 Search (جستجو)',
  menu_visible_favorites: '⭐ My Menus (منوهای من)',
  menu_visible_about: '🏠 About Us (درباره ما)',
  menu_visible_drinks: '☕ Drinks (نوشیدنی‌ها)',
  menu_visible_beans: '🌱 Beans (دانه‌های قهوه)',
  menu_visible_cakes: '🍰 Cakes (کیک و کوکی)',
  menu_visible_branches: '📍 Branches (شعب)',
  menu_visible_faq: '❓ FAQ (سوالات متداول)',
};

const BUILTIN_KEYS = ['instagram', 'phone', 'price_unit', 'ai_greeting', 'about'];
const BUILTIN_LABELS: Record<string, string> = {
  instagram: 'Instagram URL',
  phone: 'Contact Phone',
  price_unit: 'Price Unit',
  ai_greeting: 'AI Greeting',
  about: 'About Text (shown in "درباره ما" and AI context)',
};

export default function SettingsPage() {
  const { setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<{ settings: any[] }>('/settings').then((r) => r.settings),
  });

  const [localSettings, setLocalSettings] = useState<any[]>(settings);
  const [initialized, setInitialized] = useState(false);
  if (!initialized && settings.length > 0) {
    setLocalSettings(settings);
    setInitialized(true);
  }

  const [newSettingKey, setNewSettingKey] = useState('');
  const [newSettingValue, setNewSettingValue] = useState('');

  const saveSettingsMutation = useMutation({
    mutationFn: (body: any) => apiFetch('/settings', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      showToast('Saved ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: (key: string) =>
      apiFetch(`/settings/${encodeURIComponent(key)}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      showToast('Setting deleted', 'success');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const [menuVisInitialized, setMenuVisInitialized] = useState(false);
  const [menuVis, setMenuVis] = useState<Record<string, boolean>>({});

  const saveMenuVisMutation = useMutation({
    mutationFn: async (data: { key: string; visible: boolean }) => {
      return apiFetch(`/settings/${encodeURIComponent(data.key)}`, {
        method: 'PUT',
        body: { value: data.visible ? 'true' : 'false' },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      showToast('Saved ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const { data: streakConfig } = useQuery({
    queryKey: queryKeys.streakConfig,
    queryFn: () => apiFetch<{ streakMessages: boolean; streakCronEnabled: boolean }>('/streaks/config'),
  });

  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiFetch<{ status: string; db: boolean; timestamp: string }>('/health'),
    refetchInterval: 30000,
  });

  if (isLoading) return <LoadingScreen />;

  const updateSetting = (key: string, value: string) => {
    setLocalSettings((prev) => {
      const exists = prev.find((s: any) => s.key === key);
      if (exists) return prev.map((s: any) => (s.key === key ? { ...s, value } : s));
      return [...prev, { key, value }];
    });
  };

  // Initialize menu visibility state from settings data
  if (!menuVisInitialized && settings.length > 0) {
    const initial: Record<string, boolean> = {};
    for (const key of MENU_VISIBILITY_KEYS) {
      const setting = settings.find((s: any) => s.key === key);
      // Missing key = visible (default)
      initial[key] = setting?.value !== 'false';
    }
    setMenuVis(initial);
    setMenuVisInitialized(true);
  }

  const handleToggleMenuVis = (key: string, visible: boolean) => {
    setMenuVis((prev) => ({ ...prev, [key]: visible }));
    saveMenuVisMutation.mutate({ key, visible });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettingsMutation.mutate({ settings: localSettings });
  };

  const handleAddSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSettingKey) return;
    updateSetting(newSettingKey, newSettingValue);
    setNewSettingKey('');
    setNewSettingValue('');
  };

  const handleDeleteSetting = async (key: string) => {
    if (!(await confirm(`Delete setting ${key}?`))) return;
    setLocalSettings((prev) => prev.filter((s: any) => s.key !== key));
    deleteSettingMutation.mutate(key);
  };

  return (
    <>
      <div className="card">
        <h2>🔘 Menu Visibility</h2>
        <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
          Show or hide top-level bot menu sections. Hidden sections show an "unavailable" message to users.
        </p>
        <ul className="list">
          {MENU_VISIBILITY_KEYS.map((key) => (
            <li key={key} className="list-item">
              <div className="list-item-info">
                <span>{MENU_VISIBILITY_LABELS[key]}</span>
                <span className="list-item-meta">
                  {menuVis[key] ? '✅ Visible' : '❌ Hidden'}
                </span>
              </div>
              <div className="list-item-actions">
                <button
                  className={menuVis[key] ? 'danger' : 'primary'}
                  onClick={() => handleToggleMenuVis(key, !menuVis[key])}
                  disabled={saveMenuVisMutation.isPending}
                >
                  {saveMenuVisMutation.isPending ? '...' : (menuVis[key] ? 'Hide' : 'Show')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Bot Settings</h2>
        <form onSubmit={handleSaveSettings}>
          {BUILTIN_KEYS.map((key) => (
            <Field key={key} label={BUILTIN_LABELS[key] || key}>
              {key === 'about' ? (
                <textarea
                  value={localSettings.find((s: any) => s.key === key)?.value || ''}
                  onChange={(e) => updateSetting(key, e.target.value)}
                  dir="auto"
                  rows={4}
                />
              ) : (
                <input
                  value={localSettings.find((s: any) => s.key === key)?.value || ''}
                  onChange={(e) => updateSetting(key, e.target.value)}
                  dir={key === 'ai_greeting' || key === 'about' ? 'auto' : undefined}
                />
              )}
            </Field>
          ))}
          <button type="submit" className="primary" disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? '⏳...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Custom Settings</h2>
        {localSettings.filter((s: any) => !BUILTIN_KEYS.includes(s.key)).length === 0 ? (
          <EmptyState message="No custom settings." />
        ) : (
          <ul className="list">
            {localSettings
              .filter((s: any) => !BUILTIN_KEYS.includes(s.key))
              .map((s) => (
                <li key={s.key} className="list-item">
                  <div className="list-item-info">
                    <span>{s.key}</span>
                    <span className="list-item-meta" dir="auto">
                      {s.value}
                    </span>
                  </div>
                  <div className="list-item-actions">
                    <button className="danger" onClick={() => handleDeleteSetting(s.key)} disabled={deleteSettingMutation.isPending}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Add Custom Setting</h2>
        <form onSubmit={handleAddSetting}>
          <Field label="Key">
            <input
              value={newSettingKey}
              onChange={(e) => setNewSettingKey(e.target.value)}
              required
            />
          </Field>
          <Field label="Value">
            <input value={newSettingValue} onChange={(e) => setNewSettingValue(e.target.value)} />
          </Field>
          <button type="submit" className="primary">
            Add Setting
          </button>
        </form>
      </div>

      <div className="card">
        <h2>System Health</h2>
        <ul className="list">
          <li className="list-item">
            <div className="list-item-info">
              <span>API Status</span>
              <span className="list-item-meta">{health?.status === 'ok' ? '✅ Healthy' : '⚠️ ' + (health?.status ?? 'Unknown')}</span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>Database</span>
              <span className="list-item-meta">{health?.db ? '✅ Connected' : '❌ Unreachable'}</span>
            </div>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Feature Flags (read-only)</h2>
        <ul className="list">
          <li className="list-item">
            <div className="list-item-info">
              <span>STREAK_MESSAGES</span>
              <span className="list-item-meta">{streakConfig?.streakMessages ? '✅ ON' : '❌ OFF'}</span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>STREAK_CRON_ENABLED</span>
              <span className="list-item-meta">{streakConfig?.streakCronEnabled ? '✅ ON' : '❌ OFF'}</span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>USE_CONVERSATIONS</span>
              <span className="list-item-meta" style={{ color: '#999' }}>🔒 Requires code changes</span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>PERF_LOG</span>
              <span className="list-item-meta" style={{ color: '#999' }}>🔒 Set via wrangler secret</span>
            </div>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>🤖 AI Assistant</h2>
        <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
          The AI assistant's personality and behavior are configured in the bot's source code (<code>AiService</code>).
          The settings below affect the context the AI uses:
        </p>
        <ul className="list">
          <li className="list-item">
            <div className="list-item-info">
              <span><b>about</b> — Shop description in AI context</span>
              <span className="list-item-meta">↑ Set above</span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span><b>ai_greeting</b> — Initial greeting message</span>
              <span className="list-item-meta">↑ Set above</span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span><b>Products / FAQs / Branches</b> — All managed data feeds the AI</span>
              <span className="list-item-meta">↑ Managed in their pages</span>
            </div>
          </li>
        </ul>
      </div>
    </>
  );
}
