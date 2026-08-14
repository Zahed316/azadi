import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type { CategoriesResponse, Category } from '../api/types';
import { useAppContext } from '../AppContext';
import Field from './Field';
import EmptyState from './EmptyState';
import { CategorySkeleton } from './SkeletonLoader';

export default function CategoriesSubTab() {
  const { isSuperAdmin, setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<CategoriesResponse>('/categories').then((r) => r.categories),
  });

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSort, setCatSort] = useState('0');

  const saveCategoryMutation = useMutation({
    mutationFn: (data: {
      method: string;
      id?: number;
      body: { name: string; emoji: string; description: string; sortOrder: number };
    }) =>
      apiFetch(data.id ? `/categories/${data.id}` : '/categories', {
        method: data.method,
        body: data.body,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      resetCategoryForm();
      showToast(variables.id ? 'دسته‌بندی به‌روزرسانی شد ✓' : 'دسته‌بندی اضافه شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      showToast('دسته‌بندی حذف شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  if (isLoading) return <CategorySkeleton />;

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    saveCategoryMutation.mutate({
      method: editingCategory ? 'PUT' : 'POST',
      id: editingCategory?.id,
      body: { name: catName, emoji: catEmoji, description: catDesc, sortOrder: parseInt(catSort) },
    });
  };

  const deleteCategory = async (id: number) => {
    if (!(await confirm('مطمئن هستید؟'))) return;
    deleteCategoryMutation.mutate(id);
  };

  const startEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCatName(c.name);
    setCatEmoji(c.emoji || '');
    setCatDesc(c.description || '');
    setCatSort(c.sortOrder?.toString() || '0');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCatName('');
    setCatEmoji('');
    setCatDesc('');
    setCatSort('0');
  };

  return (
    <>
      {isSuperAdmin && (
        <div className="card">
          <h2>{editingCategory ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی'}</h2>
          <form onSubmit={handleSaveCategory}>
            <Field label="نام">
              <input value={catName} onChange={(e) => setCatName(e.target.value)} required />
            </Field>
            <Field label="ایموجی">
              <input value={catEmoji} onChange={(e) => setCatEmoji(e.target.value)} />
            </Field>
            <Field label="توضیحات">
              <textarea value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />
            </Field>
            <Field label="ترتیب نمایش">
              <input type="number" value={catSort} onChange={(e) => setCatSort(e.target.value)} />
            </Field>
            <button type="submit" className="primary" disabled={saveCategoryMutation.isPending}>
              {saveCategoryMutation.isPending
                ? '⏳...'
                : (editingCategory ? 'به‌روزرسانی' : 'افزودن') + ' دسته‌بندی'}
            </button>
            {editingCategory && (
              <button type="button" className="secondary" onClick={resetCategoryForm}>
                انصراف
              </button>
            )}
          </form>
        </div>
      )}

      <div className="card">
        <h2>دسته‌بندی‌ها</h2>
        {categories.length === 0 ? (
          <EmptyState message="دسته‌بندی‌ها به مرتب‌سازی منو کمک می‌کنند. برای شروع یکی اضافه کنید." />
        ) : (
          <div className="category-list">
            {categories.map((c) => (
              <div key={c.id} className="category-item">
                <span className="category-emoji" dir="auto">
                  {c.emoji}
                </span>
                <div className="category-info">
                  <strong dir="auto">{c.name}</strong>
                  {c.description && <p dir="auto">{c.description}</p>}
                </div>
                {isSuperAdmin && (
                  <div className="category-actions">
                    <button className="secondary" onClick={() => startEditCategory(c)}>
                      ویرایش
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        void deleteCategory(c.id);
                      }}
                      disabled={deleteCategoryMutation.isPending}
                    >
                      حذف
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
