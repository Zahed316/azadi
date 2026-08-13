import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';

export default function AdminsPage() {
  const { setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: admins = [], isLoading } = useQuery({
    queryKey: queryKeys.admins,
    queryFn: () => apiFetch<{ admins: any[] }>('/admins').then((r) => r.admins),
  });

  const [adminId, setAdminId] = useState('');
  const [adminRole, setAdminRole] = useState('category_admin');
  const [adminCatId, setAdminCatId] = useState('');

  const addAdminMutation = useMutation({
    mutationFn: (body: any) => apiFetch('/admins', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admins });
      showToast('ادمین اضافه شد', 'success');
      setAdminId('');
      setAdminCatId('');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteAdminMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admins/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admins });
      showToast('ادمین حذف شد', 'success');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  if (isLoading) return <LoadingScreen />;

  const handleSaveAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    addAdminMutation.mutate({ telegramId: adminId, role: adminRole, categoryId: adminCatId });
  };

  const deleteAdmin = async (id: number) => {
    if (!(await confirm('ادمین حذف شود؟'))) return;
    deleteAdminMutation.mutate(id);
  };

  return (
    <>
      <div className="card">
        <h2>افزودن ادمین</h2>
        <form onSubmit={handleSaveAdmin}>
          <Field label="آیدی تلگرام">
            <input value={adminId} onChange={(e) => setAdminId(e.target.value)} required />
          </Field>
          <Field label="نقش">
            <select value={adminRole} onChange={(e) => setAdminRole(e.target.value)}>
              <option value="category_admin">ادمین دسته‌بندی</option>
              <option value="super_admin">ادمین کل</option>
            </select>
          </Field>
          {adminRole === 'category_admin' && (
            <Field label="آیدی دسته‌بندی">
              <input value={adminCatId} onChange={(e) => setAdminCatId(e.target.value)} />
            </Field>
          )}
          <button type="submit" className="primary" disabled={addAdminMutation.isPending}>
            {addAdminMutation.isPending ? '⏳...' : 'افزودن ادمین'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>ادمین‌ها</h2>
        {admins.length === 0 ? (
          <EmptyState message="هنوز ادمینی وجود ندارد. برای اعطای دسترسی ادمین، آیدی تلگرام را اضافه کنید." />
        ) : (
          <ul className="list">
            {admins.map((a) => (
              <li key={a.id} className="list-item">
                <div className="list-item-info">
                  <span>{a.telegramId}</span>
                  <span className="list-item-meta">{a.role}</span>
                </div>
                <div className="list-item-actions">
                  <button
                    className="danger"
                    onClick={() => deleteAdmin(a.id)}
                    disabled={deleteAdminMutation.isPending}
                  >
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
