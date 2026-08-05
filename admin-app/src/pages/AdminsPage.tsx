import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';

export default function AdminsPage() {
  const { setError, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: admins = [] } = useQuery({
    queryKey: queryKeys.admins,
    queryFn: () => apiFetch<{ admins: any[] }>('/admins').then(r => r.admins),
  });

  const [adminId, setAdminId] = useState('');
  const [adminRole, setAdminRole] = useState('category_admin');
  const [adminCatId, setAdminCatId] = useState('');

  const addAdminMutation = useMutation({
    mutationFn: (body: any) => apiFetch('/admins', { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admins });
      setAdminId(''); setAdminCatId('');
    },
    onError: (err: Error) => { setError(err.message); },
  });

  const deleteAdminMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admins/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admins });
    },
    onError: (err: Error) => { setError(err.message); },
  });

  const handleSaveAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    addAdminMutation.mutate({ telegramId: adminId, role: adminRole, categoryId: adminCatId });
  };

  const deleteAdmin = async (id: number) => {
    if (!(await confirm('Remove admin?'))) return;
    deleteAdminMutation.mutate(id);
  };

  return (
    <>
      <div className="card">
        <h2>Add Admin</h2>
        <form onSubmit={handleSaveAdmin}>
          <Field label="Telegram ID"><input value={adminId} onChange={e => setAdminId(e.target.value)} required /></Field>
          <Field label="Role">
            <select value={adminRole} onChange={e => setAdminRole(e.target.value)}>
              <option value="category_admin">Category Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </Field>
          {adminRole === 'category_admin' && (
            <Field label="Category ID"><input value={adminCatId} onChange={e => setAdminCatId(e.target.value)} /></Field>
          )}
          <button type="submit" className="primary">Add Admin</button>
        </form>
      </div>

      <div className="card">
        <h2>Admins</h2>
        {admins.length === 0 ? <EmptyState message="No admins yet." /> : (
          <ul className="list">
            {admins.map(a => (
              <li key={a.id} className="list-item">
                <div className="list-item-info">
                  <span>{a.telegramId}</span>
                  <span className="list-item-meta">{a.role}</span>
                </div>
                <div className="list-item-actions">
                  <button className="danger" onClick={() => deleteAdmin(a.id)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
