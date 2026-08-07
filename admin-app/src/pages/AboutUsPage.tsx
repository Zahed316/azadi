import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';

export default function AboutUsPage() {
  const { setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  // About text
  const { data: settings = [] } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<{ settings: any[] }>('/settings').then((r) => r.settings),
  });

  const aboutSetting = settings.find((s: any) => s.key === 'about');
  const [aboutText, setAboutText] = useState(aboutSetting?.value || '');

  // Sync aboutText when settings query loads
  const [initialized, setInitialized] = useState(false);
  if (!initialized && aboutSetting) {
    setAboutText(aboutSetting.value || '');
    setInitialized(true);
  }

  const saveAboutMutation = useMutation({
    mutationFn: (body: any) => apiFetch('/settings', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      showToast('About text saved ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const handleSaveAbout = () => {
    const updatedSettings = settings.map((s: any) =>
      s.key === 'about' ? { ...s, value: aboutText } : s,
    );
    if (!updatedSettings.find((s: any) => s.key === 'about')) {
      updatedSettings.push({ key: 'about', value: aboutText });
    }
    saveAboutMutation.mutate({ settings: updatedSettings });
  };

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
      showToast(variables.id ? 'Location updated ✓' : 'Location added ✓');
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
      showToast('Location deleted ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

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
    if (!(await confirm('Delete this location?'))) return;
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
        <h2>About Us</h2>
        <textarea
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          rows={6}
          dir="auto"
          placeholder="About text shown in the bot..."
        />
        <button className="primary" onClick={handleSaveAbout}>
          Save About Text
        </button>
      </div>

      <div className="card">
        <h2>{editingBranch ? 'Edit Location' : 'Add Location'}</h2>
        <form onSubmit={handleSaveBranch}>
          <Field label="Name">
            <input value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
          </Field>
          <Field label="Address">
            <input
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              dir="auto"
              required
            />
          </Field>
          <Field label="Phone">
            <input value={branchPhone} onChange={(e) => setBranchPhone(e.target.value)} />
          </Field>
          <Field label="Location (URL)">
            <input value={branchLocation} onChange={(e) => setBranchLocation(e.target.value)} />
          </Field>
          <Field label="Opening Hours">
            <input
              value={branchHours}
              onChange={(e) => setBranchHours(e.target.value)}
              dir="auto"
            />
          </Field>
          <Field label="Active">
            <input
              type="checkbox"
              checked={branchActive}
              onChange={(e) => setBranchActive(e.target.checked)}
            />
          </Field>
          <button type="submit" className="primary">
            {editingBranch ? 'Update' : 'Add'} Location
          </button>
          {editingBranch && (
            <button type="button" className="secondary" onClick={resetBranchForm}>
              Cancel
            </button>
          )}
        </form>
      </div>

      <div className="card">
        <h2>Locations</h2>
        {branches.length === 0 ? (
          <EmptyState message="No locations yet." />
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
                    Edit
                  </button>
                  <button className="danger" onClick={() => deleteBranch(b.id)}>
                    Delete
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
