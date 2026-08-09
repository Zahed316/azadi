import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';

export default function AboutUsPage() {
  const { setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  // About text
  const { data: settings = [], isLoading } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<{ settings: any[] }>('/settings').then((r) => r.settings),
  });

  const [aboutText, setAboutText] = useState('');

  // Sync aboutText when settings query loads
  const [initialized, setInitialized] = useState(false);
  const aboutSetting = settings.find((s: any) => s.key === 'about');
  if (!initialized && aboutSetting) {
    setAboutText(aboutSetting.value || '');
    setInitialized(true);
  }

  const saveAboutMutation = useMutation({
    mutationFn: (body: any) => apiFetch('/settings', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      showToast('متن درباره ما ذخیره شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  // Branches
  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiFetch<{ branches: any[] }>('/branches').then((r) => r.branches),
  });

  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [branchHours, setBranchHours] = useState('');
  const [branchActive, setBranchActive] = useState(true);

  const saveBranchMutation = useMutation({
    mutationFn: (data: { method: string; id?: number; body: any }) =>
      apiFetch(data.id ? `/branches/${data.id}` : '/branches', {
        method: data.method,
        body: data.body,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      resetBranchForm();
      showToast(variables.id ? 'مکان به‌روزرسانی شد ✓' : 'مکان اضافه شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/branches/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      showToast('مکان حذف شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  if (isLoading) return <LoadingScreen />;

  const handleSaveAbout = () => {
    const updatedSettings = settings.map((s: any) =>
      s.key === 'about' ? { ...s, value: aboutText } : s,
    );
    if (!updatedSettings.find((s: any) => s.key === 'about')) {
      updatedSettings.push({ key: 'about', value: aboutText });
    }
    saveAboutMutation.mutate({ settings: updatedSettings });
  };

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    saveBranchMutation.mutate({
      method: editingBranch ? 'PUT' : 'POST',
      id: editingBranch?.id,
      body: {
        name: branchName,
        address: branchAddress,
        phone: branchPhone,
        location: branchLocation,
        openingHours: branchHours,
        isActive: branchActive,
      },
    });
  };

  const deleteBranch = async (id: number) => {
    if (!(await confirm('این مکان حذف شود؟'))) return;
    deleteBranchMutation.mutate(id);
  };

  const startEditBranch = (b: any) => {
    setEditingBranch(b);
    setBranchName(b.name);
    setBranchAddress(b.address);
    setBranchPhone(b.phone || '');
    setBranchLocation(b.location || '');
    setBranchHours(b.openingHours || '');
    setBranchActive(b.isActive);
  };

  const resetBranchForm = () => {
    setEditingBranch(null);
    setBranchName('');
    setBranchAddress('');
    setBranchPhone('');
    setBranchLocation('');
    setBranchHours('');
    setBranchActive(true);
  };

  return (
    <>
      <div className="card">
        <h2>درباره ما</h2>
        <Field label="متن درباره ما">
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            rows={6}
            dir="auto"
            placeholder="متنی که در ربات نمایش داده می‌شود..."
          />
        </Field>
        <button className="primary" onClick={handleSaveAbout} disabled={saveAboutMutation.isPending}>
          {saveAboutMutation.isPending ? '⏳...' : 'ذخیره متن درباره ما'}
        </button>
      </div>

      <div className="card">
        <h2>{editingBranch ? 'ویرایش مکان' : 'افزودن مکان'}</h2>
        <form onSubmit={handleSaveBranch}>
          <Field label="نام">
            <input value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
          </Field>
          <Field label="آدرس">
            <input
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              dir="auto"
              required
            />
          </Field>
          <Field label="تلفن">
            <input value={branchPhone} onChange={(e) => setBranchPhone(e.target.value)} />
          </Field>
          <Field label="مکان (لینک)">
            <input value={branchLocation} onChange={(e) => setBranchLocation(e.target.value)} />
          </Field>
          <Field label="ساعت کاری">
            <input
              value={branchHours}
              onChange={(e) => setBranchHours(e.target.value)}
              dir="auto"
            />
          </Field>
          <Field label="فعال">
            <input
              type="checkbox"
              checked={branchActive}
              onChange={(e) => setBranchActive(e.target.checked)}
            />
          </Field>
          <button type="submit" className="primary" disabled={saveBranchMutation.isPending}>
            {saveBranchMutation.isPending ? '⏳...' : (editingBranch ? 'به‌روزرسانی' : 'افزودن') + ' مکان'}
          </button>
          {editingBranch && (
            <button type="button" className="secondary" onClick={resetBranchForm}>
              انصراف
            </button>
          )}
        </form>
      </div>

      <div className="card">
        <h2>شعب</h2>
        {branches.length === 0 ? (
          <EmptyState message="هنوز شعبی وجود ندارد." />
        ) : (
          <ul className="list">
            {branches.map((b) => (
              <li key={b.id} className="list-item">
                <div className="list-item-info">
                  <span dir="auto">{b.name}</span>
                  <span className="list-item-meta" dir="auto">
                    {b.address}
                  </span>
                </div>
                <div className="list-item-actions">
                  <button className="secondary" onClick={() => startEditBranch(b)}>
                    ویرایش
                  </button>
                  <button className="danger" onClick={() => deleteBranch(b.id)} disabled={deleteBranchMutation.isPending}>
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
