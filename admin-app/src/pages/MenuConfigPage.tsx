import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import LoadingScreen from '../components/Spinner';

type Section = 'drinks' | 'beans' | 'cakes' | 'extras';

export default function MenuConfigPage() {
  const { setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: menuConfigs = [], isLoading } = useQuery({
    queryKey: queryKeys.menuConfigs,
    queryFn: () => apiFetch<{ menuConfigs: any[] }>('/menu-config').then((r) => r.menuConfigs),
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<{ categories: any[] }>('/categories').then((r) => r.categories),
  });

  const [menuActiveSection, setMenuActiveSection] = useState<Section>('drinks');
  const [menuAddCatId, setMenuAddCatId] = useState('');
  const [editingSpecialMsg, setEditingSpecialMsg] = useState<number | null>(null);
  const [specialMsgValue, setSpecialMsgValue] = useState('');
  const [editingButtonLabel, setEditingButtonLabel] = useState<number | null>(null);
  const [buttonLabelValue, setButtonLabelValue] = useState('');

  const toggleVisibilityMutation = useMutation({
    mutationFn: (data: { id: number; body: any }) =>
      apiFetch(`/menu-config/${data.id}`, { method: 'PUT', body: data.body }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.menuConfigs });
      const prev = queryClient.getQueryData(queryKeys.menuConfigs);
      queryClient.setQueryData(queryKeys.menuConfigs, (old: any[] | undefined) =>
        old?.map((c) => (c.id === data.id ? { ...c, isVisible: !c.isVisible } : c)),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(queryKeys.menuConfigs, context.prev);
      showToast('Visibility update failed', 'error');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.menuConfigs });
    },
    onSuccess: () => {
      showToast('Visibility updated', 'success');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: any[]) =>
      apiFetch('/menu-config/reorder', { method: 'POST', body: { items } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.menuConfigs });
      showToast('Menu reordered', 'success');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMenuConfigMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/menu-config/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.menuConfigs });
      showToast('Item removed from menu', 'success');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const addToSectionMutation = useMutation({
    mutationFn: (body: any) => apiFetch('/menu-config', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.menuConfigs });
      showToast('Item added to menu', 'success');
      setMenuAddCatId('');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const saveSpecialMessageMutation = useMutation({
    mutationFn: (data: { id: number; body: any }) =>
      apiFetch(`/menu-config/${data.id}`, { method: 'PUT', body: data.body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.menuConfigs });
      showToast('Menu item updated', 'success');
      setEditingSpecialMsg(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  if (isLoading) return <LoadingScreen />;

  const sectionItems = menuConfigs
    .filter((c: any) => c.menuSection === menuActiveSection)
    .sort((a: any, b: any) => a.displayOrder - b.displayOrder);

  const handleToggleMenuVisibility = (config: any) => {
    toggleVisibilityMutation.mutate({
      id: config.id,
      body: { ...config, isVisible: !config.isVisible },
    });
  };

  const handleMenuReorder = (id: number, direction: 'up' | 'down') => {
    const idx = sectionItems.findIndex((c: any) => c.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sectionItems.length) return;
    const items = [
      { id: sectionItems[idx].id, displayOrder: sectionItems[swapIdx].displayOrder },
      { id: sectionItems[swapIdx].id, displayOrder: sectionItems[idx].displayOrder },
    ];
    reorderMutation.mutate(items);
  };

  const handleDeleteMenuConfig = async (id: number) => {
    if (!(await confirm('Remove from menu?'))) return;
    deleteMenuConfigMutation.mutate(id);
  };

  const handleAddToSection = () => {
    if (!menuAddCatId) return;
    const maxOrder = sectionItems.reduce((m: number, c: any) => Math.max(m, c.displayOrder), 0);
    addToSectionMutation.mutate({
      categoryId: parseInt(menuAddCatId),
      menuSection: menuActiveSection,
      displayOrder: maxOrder + 1,
      isVisible: true,
    });
  };

  const handleSaveSpecialMessage = (configId: number) => {
    const config = menuConfigs.find((c: any) => c.id === configId);
    saveSpecialMessageMutation.mutate({
      id: configId,
      body: { ...config, specialMessage: specialMsgValue || null },
    });
  };

  const handleSaveButtonLabel = (configId: number) => {
    const config = menuConfigs.find((c: any) => c.id === configId);
    saveSpecialMessageMutation.mutate({
      id: configId,
      body: { ...config, buttonLabel: buttonLabelValue || null },
    });
  };

  return (
    <>
      <div className="card">
        <h2>Menu Configuration</h2>
        <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 12 }}>
          Menu order here controls the bot's inline keyboard layout. Sections: ☕ Drinks, 🌱 Beans, 🍰 Cakes, 📍 Branches. Use the bot's <code>/start</code> command to preview the result.
        </p>
        <div className="section-tabs">
          {(['drinks', 'beans', 'cakes', 'extras'] as Section[]).map((sec) => (
            <button
              key={sec}
              className={`tab ${menuActiveSection === sec ? 'active' : ''}`}
              onClick={() => setMenuActiveSection(sec)}
            >
              {sec.charAt(0).toUpperCase() + sec.slice(1)}
            </button>
          ))}
        </div>

        {sectionItems.length === 0 ? (
          <div className="empty-state">No items in this section.</div>
        ) : (
          <ul className="list">
            {sectionItems.map((config: any, idx: number) => (
              <li key={config.id} className="list-item">
                <div className="list-item-info">
                  <span dir="auto">
                    {categories.find((c: any) => c.id === config.categoryId)?.name || 'Unknown'}
                  </span>
                  <span className="list-item-meta">{config.isVisible ? 'Visible' : 'Hidden'}</span>
                  {config.buttonLabel && (
                    <span className="list-item-meta" style={{ fontSize: '0.8em', opacity: 0.7 }}>
                      "{config.buttonLabel}"
                    </span>
                  )}
                </div>
                <div className="list-item-actions">
                  <button className="secondary" onClick={() => handleToggleMenuVisibility(config)} disabled={toggleVisibilityMutation.isPending}>
                    {config.isVisible ? 'Hide' : 'Show'}
                  </button>
                  {idx > 0 && (
                    <button
                      className="secondary"
                      onClick={() => handleMenuReorder(config.id, 'up')}
                    >
                      ↑
                    </button>
                  )}
                  {idx < sectionItems.length - 1 && (
                    <button
                      className="secondary"
                      onClick={() => handleMenuReorder(config.id, 'down')}
                    >
                      ↓
                    </button>
                  )}
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditingSpecialMsg(config.id);
                      setSpecialMsgValue(config.specialMessage || '');
                    }}
                  >
                    Msg
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditingButtonLabel(config.id);
                      setButtonLabelValue(config.buttonLabel || '');
                    }}
                  >
                    Label
                  </button>
                  <button className="danger" onClick={() => handleDeleteMenuConfig(config.id)} disabled={deleteMenuConfigMutation.isPending}>
                    Delete
                  </button>
                </div>
                {editingSpecialMsg === config.id && (
                  <div className="special-msg-form">
                    <Field label="Special Message">
                      <textarea
                        value={specialMsgValue}
                        onChange={(e) => setSpecialMsgValue(e.target.value)}
                        dir="auto"
                        rows={3}
                      />
                    </Field>
                    <button className="primary" onClick={() => handleSaveSpecialMessage(config.id)} disabled={saveSpecialMessageMutation.isPending}>
                      Save
                    </button>
                    <button className="secondary" onClick={() => setEditingSpecialMsg(null)}>
                      Cancel
                    </button>
                  </div>
                )}
                {editingButtonLabel === config.id && (
                  <div className="special-msg-form">
                    <Field label="Button Label (overrides default)">
                      <input
                        value={buttonLabelValue}
                        onChange={(e) => setButtonLabelValue(e.target.value)}
                        placeholder="Custom label for bot button"
                        dir="auto"
                      />
                    </Field>
                    <button className="primary" onClick={() => handleSaveButtonLabel(config.id)} disabled={saveSpecialMessageMutation.isPending}>
                      Save
                    </button>
                    <button className="secondary" onClick={() => setEditingButtonLabel(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Add to {menuActiveSection}</h2>
        <Field label="Category">
          <select value={menuAddCatId} onChange={(e) => setMenuAddCatId(e.target.value)}>
            <option value="">Select category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <button className="primary" onClick={handleAddToSection} disabled={addToSectionMutation.isPending}>
          {addToSectionMutation.isPending ? '⏳...' : 'Add'}
        </button>
      </div>
    </>
  );
}
