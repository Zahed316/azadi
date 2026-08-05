import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';

const BUILTIN_KEYS = ['instagram', 'phone', 'price_unit', 'ai_greeting'];
const BUILTIN_LABELS: Record<string, string> = {
  instagram: 'Instagram URL',
  phone: 'Contact Phone',
  price_unit: 'Price Unit',
  ai_greeting: 'AI Greeting',
};

export default function SettingsPage() {
  const { setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<{ settings: any[] }>('/settings').then(r => r.settings),
  });

  const [localSettings, setLocalSettings] = useState<any[]>(settings);
  const [initialized, setInitialized] = useState(false);
  if (!initialized && settings.length > 0) {
    setLocalSettings(settings);
    setInitialized(true);
  }

  const [newSettingKey, setNewSettingKey] = useState('');
  const [newSettingValue, setNewSettingValue] = useState('');

  const updateSetting = (key: string, value: string) => {
    setLocalSettings(prev => {
      const exists = prev.find((s: any) => s.key === key);
      if (exists) return prev.map((s: any) => s.key === key ? { ...s, value } : s);
      return [...prev, { key, value }];
    });
  };

  const saveSettingsMutation = useMutation({
    mutationFn: (body: any) => apiFetch('/settings', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      showToast('Saved ✓');
    },
    onError: (err: Error) => { setError(err.message); },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: (key: string) => apiFetch(`/settings/${encodeURIComponent(key)}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
    onError: (err: Error) => { setError(err.message); },
  });

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
    setLocalSettings(prev => prev.filter((s: any) => s.key !== key));
    deleteSettingMutation.mutate(key);
  };

  return (
    <>
      <div className="card">
        <h2>Bot Settings</h2>
        <form onSubmit={handleSaveSettings}>
          {BUILTIN_KEYS.map(key => (
            <Field key={key} label={BUILTIN_LABELS[key] || key}>
              <input
                value={localSettings.find((s: any) => s.key === key)?.value || ''}
                onChange={e => updateSetting(key, e.target.value)}
                dir={key === 'ai_greeting' ? 'auto' : undefined}
              />
            </Field>
          ))}
          <button type="submit" className="primary">Save Settings</button>
        </form>
      </div>

      <div className="card">
        <h2>Custom Settings</h2>
        {localSettings.filter((s: any) => !BUILTIN_KEYS.includes(s.key)).length === 0
          ? <EmptyState message="No custom settings." />
          : (
            <ul className="list">
              {localSettings.filter((s: any) => !BUILTIN_KEYS.includes(s.key)).map(s => (
                <li key={s.key} className="list-item">
                  <div className="list-item-info">
                    <span>{s.key}</span>
                    <span className="list-item-meta" dir="auto">{s.value}</span>
                  </div>
                  <div className="list-item-actions">
                    <button className="danger" onClick={() => handleDeleteSetting(s.key)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>

      <div className="card">
        <h2>Add Custom Setting</h2>
        <form onSubmit={handleAddSetting}>
          <Field label="Key"><input value={newSettingKey} onChange={e => setNewSettingKey(e.target.value)} required /></Field>
          <Field label="Value"><input value={newSettingValue} onChange={e => setNewSettingValue(e.target.value)} /></Field>
          <button type="submit" className="primary">Add Setting</button>
        </form>
      </div>
    </>
  );
}
