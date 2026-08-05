import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';

export default function CategoriesPage() {
  const { isSuperAdmin, setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<{ categories: any[] }>('/categories').then(r => r.categories),
  });

  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSort, setCatSort] = useState('0');

  const saveCategoryMutation = useMutation({
    mutationFn: (data: { method: string; id?: number; body: any }) =>
      apiFetch(data.id ? `/categories/${data.id}` : '/categories', {
        method: data.method,
        body: data.body,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      resetCategoryForm();
      showToast(variables.id ? 'Category updated ✓' : 'Category added ✓');
    },
    onError: (err: Error) => { setError(err.message); showToast(err.message, 'error'); },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      showToast('Category deleted ✓');
    },
    onError: (err: Error) => { setError(err.message); showToast(err.message, 'error'); },
  });

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    saveCategoryMutation.mutate({
      method: editingCategory ? 'PUT' : 'POST',
      id: editingCategory?.id,
      body: { name: catName, emoji: catEmoji, description: catDesc, sortOrder: parseInt(catSort) },
    });
  };

  const deleteCategory = async (id: number) => {
    if (!(await confirm('Are you sure?'))) return;
    deleteCategoryMutation.mutate(id);
  };

  const startEditCategory = (c: any) => {
    setEditingCategory(c);
    setCatName(c.name);
    setCatEmoji(c.emoji || '');
    setCatDesc(c.description || '');
    setCatSort(c.sortOrder?.toString() || '0');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCatName(''); setCatEmoji(''); setCatDesc(''); setCatSort('0');
  };

  return (
    <>
      {isSuperAdmin && (
        <div className="card">
          <h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
          <form onSubmit={handleSaveCategory}>
            <Field label="Name"><input value={catName} onChange={e => setCatName(e.target.value)} required /></Field>
            <Field label="Emoji"><input value={catEmoji} onChange={e => setCatEmoji(e.target.value)} /></Field>
            <Field label="Description"><textarea value={catDesc} onChange={e => setCatDesc(e.target.value)} /></Field>
            <Field label="Sort Order"><input type="number" value={catSort} onChange={e => setCatSort(e.target.value)} /></Field>
            <button type="submit" className="primary">{editingCategory ? 'Update' : 'Add'} Category</button>
            {editingCategory && <button type="button" className="secondary" onClick={resetCategoryForm}>Cancel</button>}
          </form>
        </div>
      )}

      <div className="card">
        <h2>Categories</h2>
        {categories.length === 0 ? <EmptyState message="No categories yet." /> : (
          <ul className="list">
            {categories.map(c => (
              <li key={c.id} className="list-item">
                <div className="list-item-info">
                  <span dir="auto">{c.emoji} {c.name}</span>
                </div>
                {isSuperAdmin && (
                  <div className="list-item-actions">
                    <button className="secondary" onClick={() => startEditCategory(c)}>Edit</button>
                    <button className="danger" onClick={() => deleteCategory(c.id)}>Delete</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
