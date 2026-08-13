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
  menu_visible_featured: '⭐ پیشنهاد ویژه',
  menu_visible_seasonal: '🌿 مخصوص فصل',
  menu_visible_passport: '📖 پاسپورت قهوه',
  menu_visible_search: '🔍 جستجو',
  menu_visible_favorites: '⭐ منوهای من',
  menu_visible_about: '🏠 درباره ما',
  menu_visible_drinks: '☕ نوشیدنی‌ها',
  menu_visible_beans: '🌱 دانه‌های قهوه',
  menu_visible_cakes: '🍰 کیک و کوکی',
  menu_visible_branches: '📍 شعب',
  menu_visible_faq: '❓ سوالات متداول',
};

const BUILTIN_KEYS = ['instagram', 'phone', 'price_unit', 'ai_greeting', 'about'];
const BUILTIN_LABELS: Record<string, string> = {
  instagram: 'آدرس اینستاگرام',
  phone: 'تلفن تماس',
  price_unit: 'واحد قیمت',
  ai_greeting: 'پیام خوش‌آمدگویی هوش مصنوعی',
  about: 'متن درباره ما (نمایش در «درباره ما» و متن هوش مصنوعی)',
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
      showToast('ذخیره شد ✓');
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
      showToast('تنظیمات حذف شد', 'success');
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
      showToast('ذخیره شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const { data: streakConfig } = useQuery({
    queryKey: queryKeys.streakConfig,
    queryFn: () =>
      apiFetch<{ streakMessages: boolean; streakCronEnabled: boolean }>('/streaks/config'),
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
    if (!(await confirm(`تنظیمات ${key} حذف شود؟`))) return;
    setLocalSettings((prev) => prev.filter((s: any) => s.key !== key));
    deleteSettingMutation.mutate(key);
  };

  return (
    <>
      <div className="card">
        <h2>🔘 نمایش منو</h2>
        <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
          نمایش یا مخفی‌سازی بخش‌های منوی اصلی ربات. بخش‌های مخفی‌شده پیام «در دسترس نیست» را به
          کاربران نشان می‌دهند.
        </p>
        <ul className="list">
          {MENU_VISIBILITY_KEYS.map((key) => (
            <li key={key} className="list-item">
              <div className="list-item-info">
                <span>{MENU_VISIBILITY_LABELS[key]}</span>
                <span className="list-item-meta">{menuVis[key] ? '✅ قابل نمایش' : '❌ مخفی'}</span>
              </div>
              <div className="list-item-actions">
                <button
                  className={menuVis[key] ? 'danger' : 'primary'}
                  onClick={() => handleToggleMenuVis(key, !menuVis[key])}
                  disabled={saveMenuVisMutation.isPending}
                >
                  {saveMenuVisMutation.isPending ? '...' : menuVis[key] ? 'مخفی کردن' : 'نمایش'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>تنظیمات ربات</h2>
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
            {saveSettingsMutation.isPending ? '⏳...' : 'ذخیره تنظیمات'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>تنظیمات سفارشی</h2>
        {localSettings.filter((s: any) => !BUILTIN_KEYS.includes(s.key)).length === 0 ? (
          <EmptyState message="تنظیمات سفارشی وجود ندارد." />
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
                    <button
                      className="danger"
                      onClick={() => handleDeleteSetting(s.key)}
                      disabled={deleteSettingMutation.isPending}
                    >
                      حذف
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>افزودن تنظیمات سفارشی</h2>
        <form onSubmit={handleAddSetting}>
          <Field label="کلید">
            <input
              value={newSettingKey}
              onChange={(e) => setNewSettingKey(e.target.value)}
              required
            />
          </Field>
          <Field label="مقدار">
            <input value={newSettingValue} onChange={(e) => setNewSettingValue(e.target.value)} />
          </Field>
          <button type="submit" className="primary">
            افزودن تنظیمات
          </button>
        </form>
      </div>

      <div className="card">
        <h2>سلامت سیستم</h2>
        <ul className="list">
          <li className="list-item">
            <div className="list-item-info">
              <span>وضعیت API</span>
              <span className="list-item-meta">
                {health?.status === 'ok' ? '✅ سالم' : '⚠️ ' + (health?.status ?? 'ناشناخته')}
              </span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>پایگاه داده</span>
              <span className="list-item-meta">{health?.db ? '✅ متصل' : '❌ در دسترس نیست'}</span>
            </div>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>پرچم‌های ویژگی (فقط خواندنی)</h2>
        <ul className="list">
          <li className="list-item">
            <div className="list-item-info">
              <span>STREAK_MESSAGES</span>
              <span className="list-item-meta">
                {streakConfig?.streakMessages ? '✅ روشن' : '❌ خاموش'}
              </span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>STREAK_CRON_ENABLED</span>
              <span className="list-item-meta">
                {streakConfig?.streakCronEnabled ? '✅ روشن' : '❌ خاموش'}
              </span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>USE_CONVERSATIONS</span>
              <span className="list-item-meta" style={{ color: '#999' }}>
                🔒 نیاز به تغییر کد
              </span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>PERF_LOG</span>
              <span className="list-item-meta" style={{ color: '#999' }}>
                🔒 تنظیم از طریق wrangler secret
              </span>
            </div>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>🤖 دستیار هوش مصنوعی</h2>
        <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
          شخصیت و رفتار دستیار هوش مصنوعی در کد منبع ربات (<code>AiService</code>) پیکربندی شده است.
          تنظیمات زیر روی متنی که هوش مصنوعی استفاده می‌کند اثر می‌گذارد:
        </p>
        <ul className="list">
          <li className="list-item">
            <div className="list-item-info">
              <span>
                <b>about</b> — توضیحات فروشگاه در متن هوش مصنوعی
              </span>
              <span className="list-item-meta">↑ در بالا تنظیم شده</span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>
                <b>ai_greeting</b> — پیام خوش‌آمدگویی اولیه
              </span>
              <span className="list-item-meta">↑ در بالا تنظیم شده</span>
            </div>
          </li>
          <li className="list-item">
            <div className="list-item-info">
              <span>
                <b>Products / FAQs / Branches</b> — همه داده‌های مدیریت‌شده به هوش مصنوعی داده
                می‌شود
              </span>
              <span className="list-item-meta">↑ در صفحاتشان مدیریت می‌شود</span>
            </div>
          </li>
        </ul>
      </div>
    </>
  );
}
