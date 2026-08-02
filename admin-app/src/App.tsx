import React, { useState, useEffect } from 'react';
import { retrieveLaunchParams } from '@telegram-apps/sdk';

const API_BASE = 'https://azadi-coffee-bot.zahedrastgar316.workers.dev/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'settings' | 'admins' | 'menu'>('products');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selection for Batch
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [batchAction, setBatchAction] = useState<'move' | 'toggle' | 'delete' | ''>('');
  const [batchTargetCatId, setBatchTargetCatId] = useState('');
  const [batchToggleValue, setBatchToggleValue] = useState('true');

  // Menu Config
  const [menuConfigs, setMenuConfigs] = useState<any[]>([]);
  const [menuActiveSection, setMenuActiveSection] = useState<'drinks'|'beans'|'cakes'|'extras'>('drinks');
  const [menuAddCatId, setMenuAddCatId] = useState('');

  // Edit states
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Forms
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSort, setCatSort] = useState('0');

  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodCatId, setProdCatId] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);

  const [adminId, setAdminId] = useState('');
  const [adminRole, setAdminRole] = useState('category_admin');
  const [adminCatId, setAdminCatId] = useState('');

  // Custom Settings
  const [newSettingKey, setNewSettingKey] = useState('');
  const [newSettingValue, setNewSettingValue] = useState('');

  const getInitData = () => {
    try {
      const { initDataRaw } = retrieveLaunchParams();
      return initDataRaw || '';
    } catch (e) {
      console.warn("Not running in Telegram Web App environment");
      return '';
    }
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Telegram ${getInitData()}`
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Current User
      const userRes = await fetch(`${API_BASE}/currentUser`, { headers });
      if (!userRes.ok) throw new Error(await userRes.text());
      const userData = await userRes.json();
      setCurrentUser(userData.user);

      const isSuper = userData.user?.role === 'super_admin';

      // 2. Fetch standard data
      const [prodRes, catRes] = await Promise.all([
        fetch(`${API_BASE}/products`, { headers }),
        fetch(`${API_BASE}/categories`, { headers })
      ]);
      
      const prodData = await (prodRes.ok ? prodRes.json() : { products: [] });
      const catData = await (catRes.ok ? catRes.json() : { categories: [] });
      
      setProducts(prodData.products || []);
      setCategories(catData.categories || []);
      
      if (catData.categories?.length > 0 && !prodCatId) {
        setProdCatId(catData.categories[0].id.toString());
      }

      // 3. Fetch SuperAdmin specific data
      if (isSuper) {
        const [setRes, admRes, menuRes] = await Promise.all([
          fetch(`${API_BASE}/settings`, { headers }),
          fetch(`${API_BASE}/admins`, { headers }),
          fetch(`${API_BASE}/menu-config`, { headers })
        ]);
        if (setRes.ok) {
          const s = await setRes.json();
          setSettings(s.settings || []);
        }
        if (admRes.ok) {
          const a = await admRes.json();
          setAdmins(a.admins || []);
        }
        if (menuRes.ok) {
          const m = await menuRes.json();
          setMenuConfigs(m.menuConfigs || []);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const allowedCatId = currentUser?.categoryId;

  // -- BATCH LOGIC --
  const toggleProductSelect = (id: number) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBatchExecute = async () => {
    if (!batchAction || selectedProductIds.length === 0) return;
    if (!confirm(`Apply action to ${selectedProductIds.length} products?`)) return;

    setError('');
    try {
      let updateData = undefined;
      if (batchAction === 'move') updateData = { categoryId: parseInt(batchTargetCatId) };
      if (batchAction === 'toggle') updateData = { available: batchToggleValue === 'true' };

      const body = JSON.stringify({
        ids: selectedProductIds,
        action: batchAction === 'delete' ? 'delete' : 'update',
        updateData
      });

      const res = await fetch(`${API_BASE}/products/batch`, { method: 'POST', headers, body });
      if (!res.ok) throw new Error(await res.text());
      
      setSelectedProductIds([]);
      setBatchAction('');
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // -- PRODUCTS LOGIC --
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body = JSON.stringify({
        name: prodName,
        price: parseFloat(prodPrice),
        stock: parseInt(prodStock),
        categoryId: parseInt(prodCatId),
        description: prodDesc,
        available: prodAvailable
      });

      const url = editingProduct ? `${API_BASE}/products/${editingProduct.id}` : `${API_BASE}/products`;
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers, body });
      if (!res.ok) throw new Error(await res.text());
      
      await fetchData();
      resetProductForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEditProduct = (p: any) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdPrice(p.price?.toString() || '');
    setProdStock(p.stock?.toString() || '0');
    setProdCatId(p.categoryId?.toString() || '');
    setProdDesc(p.description || '');
    setProdAvailable(p.available);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setProdName('');
    setProdPrice('');
    setProdStock('');
    setProdDesc('');
    setProdAvailable(true);
  };

  // -- CATEGORIES LOGIC --
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body = JSON.stringify({ name: catName, emoji: catEmoji, description: catDesc, sortOrder: parseInt(catSort) });
      const url = editingCategory ? `${API_BASE}/categories/${editingCategory.id}` : `${API_BASE}/categories`;
      const method = editingCategory ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body });
      if (!res.ok) throw new Error(await res.text());
      await fetchData();
      resetCategoryForm();
    } catch (err: any) { setError(err.message); }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    try {
      const res = await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      await fetchData();
    } catch (err: any) { setError(err.message); }
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

  // -- ADMINS --
  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body = JSON.stringify({ telegramId: adminId, role: adminRole, categoryId: adminCatId });
      const res = await fetch(`${API_BASE}/admins`, { method: 'POST', headers, body });
      if (!res.ok) throw new Error(await res.text());
      await fetchData();
      setAdminId(''); setAdminCatId('');
    } catch (err: any) { setError(err.message); }
  };

  const deleteAdmin = async (id: number) => {
    if (!confirm('Remove admin?')) return;
    try {
      const res = await fetch(`${API_BASE}/admins/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      await fetchData();
    } catch (err: any) { setError(err.message); }
  };

  // -- SETTINGS --
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body = JSON.stringify({ settings });
      const res = await fetch(`${API_BASE}/settings`, { method: 'POST', headers, body });
      if (!res.ok) throw new Error(await res.text());
      alert('Settings saved!');
    } catch (err: any) { setError(err.message); }
  };
  const updateSetting = (key: string, value: string) => {
    setSettings(prev => {
      const exists = prev.find(s => s.key === key);
      if (exists) {
        return prev.map(s => s.key === key ? { ...s, value } : s);
      }
      return [...prev, { key, value }];
    });
  };

  const handleAddSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSettingKey) return;
    updateSetting(newSettingKey, newSettingValue);
    setNewSettingKey('');
    setNewSettingValue('');
  };

  const handleDeleteSetting = async (key: string) => {
    if (!confirm(`Delete setting ${key}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/settings/${encodeURIComponent(key)}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      setSettings(prev => prev.filter(s => s.key !== key));
    } catch (err: any) { setError(err.message); }
  };

  // -- MENU CONFIG --
  const handleToggleMenuVisibility = async (config: any) => {
    try {
      await fetch(`${API_BASE}/menu-config/${config.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ ...config, isVisible: !config.isVisible }),
      });
      await fetchData();
    } catch (err: any) { setError(err.message); }
  };

  const handleMenuReorder = async (id: number, direction: 'up' | 'down') => {
    const sectionItems = menuConfigs
      .filter((c: any) => c.menuSection === menuActiveSection)
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder);
    const idx = sectionItems.findIndex((c: any) => c.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sectionItems.length) return;
    const items = [
      { id: sectionItems[idx].id,     displayOrder: sectionItems[swapIdx].displayOrder },
      { id: sectionItems[swapIdx].id, displayOrder: sectionItems[idx].displayOrder },
    ];
    try {
      await fetch(`${API_BASE}/menu-config/reorder`, {
        method: 'POST', headers, body: JSON.stringify({ items }),
      });
      await fetchData();
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteMenuConfig = async (id: number) => {
    if (!confirm('Remove from menu?')) return;
    try {
      await fetch(`${API_BASE}/menu-config/${id}`, { method: 'DELETE', headers });
      await fetchData();
    } catch (err: any) { setError(err.message); }
  };

  const handleAddToSection = async () => {
    if (!menuAddCatId) return;
    const sectionItems = menuConfigs.filter((c: any) => c.menuSection === menuActiveSection);
    const maxOrder = sectionItems.reduce((m: number, c: any) => Math.max(m, c.displayOrder), 0);
    try {
      await fetch(`${API_BASE}/menu-config`, {
        method: 'POST', headers,
        body: JSON.stringify({
          categoryId: parseInt(menuAddCatId),
          menuSection: menuActiveSection,
          displayOrder: maxOrder + 1,
          isVisible: true,
        }),
      });
      setMenuAddCatId('');
      await fetchData();
    } catch (err: any) { setError(err.message); }
  };


  if (loading && products.length === 0) {
    return <div className="container" style={{ textAlign: 'center', marginTop: 50 }}>Loading...</div>;
  }

  return (
    <div className="container" style={{ paddingBottom: selectedProductIds.length > 0 ? '120px' : '80px' }}>
      <h2>
        {activeTab === 'products' ? 'Products' :
         activeTab === 'categories' ? 'Categories' :
         activeTab === 'settings' ? 'Settings' :
         activeTab === 'menu' ? 'Bot Menu' : 'Admins'}
         {currentUser && <span style={{fontSize: 12, marginLeft: 10, background: '#333', padding: '2px 6px', borderRadius: 4}}>{currentUser.role}</span>}
      </h2>
      {error && <div className="error">{error}</div>}

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <>
          {(isSuperAdmin || allowedCatId) && (
            <div className="card">
              <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <form onSubmit={handleSaveProduct}>
                <input placeholder="Name" value={prodName} onChange={e => setProdName(e.target.value)} required />
                <input type="number" placeholder="Price" value={prodPrice} onChange={e => setProdPrice(e.target.value)} required />
                <input type="number" placeholder="Stock" value={prodStock} onChange={e => setProdStock(e.target.value)} required />
                <select value={prodCatId} onChange={e => setProdCatId(e.target.value)} required>
                  {categories
                    .filter(c => isSuperAdmin || c.id === allowedCatId)
                    .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <textarea placeholder="Description (Optional)" value={prodDesc} onChange={e => setProdDesc(e.target.value)} rows={2} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={prodAvailable} onChange={e => setProdAvailable(e.target.checked)} />
                  Available for sale
                </label>
                <div className="btn-group">
                  <button type="submit">{editingProduct ? 'Update' : 'Add'}</button>
                  {editingProduct && <button type="button" className="secondary" onClick={resetProductForm}>Cancel</button>}
                </div>
              </form>
            </div>
          )}

          <div className="card">
            <h3>All Products</h3>
            {products.map(p => {
              const cat = categories.find(c => c.id === p.categoryId);
              const canEdit = isSuperAdmin || p.categoryId === allowedCatId;
              
              return (
                <div key={p.id} className="list-item" style={{ opacity: p.available ? 1 : 0.6 }}>
                  {canEdit && (
                    <div style={{ marginRight: 12, display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: 18, height: 18, margin: 0 }} 
                        checked={selectedProductIds.includes(p.id)}
                        onChange={() => toggleProductSelect(p.id)}
                      />
                    </div>
                  )}
                  <div className="item-details">
                    <h4>{p.name} {p.available ? '' : '(Hidden)'}</h4>
                    <p>{p.price}T | Stock: {p.stock} | Cat: {cat ? cat.name : '?'}</p>
                  </div>
                  {canEdit ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="secondary" style={{ padding: '8px 12px' }} onClick={() => startEditProduct(p)}>Edit</button>
                      <button type="button" className="danger" style={{ padding: '8px 12px' }} onClick={() => deleteProduct(p.id)}>Del</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#888' }}>Read-only</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* BATCH ACTION BAR */}
          {selectedProductIds.length > 0 && (
            <div className="batch-bar">
              <span style={{ fontWeight: 'bold' }}>{selectedProductIds.length} Selected</span>
              <select value={batchAction} onChange={e => setBatchAction(e.target.value as any)}>
                <option value="">Choose action...</option>
                <option value="toggle">Set Visibility</option>
                <option value="move">Move Category</option>
                <option value="delete">Delete</option>
              </select>
              
              {batchAction === 'toggle' && (
                <select value={batchToggleValue} onChange={e => setBatchToggleValue(e.target.value)}>
                  <option value="true">Show</option>
                  <option value="false">Hide</option>
                </select>
              )}
              {batchAction === 'move' && (
                <select value={batchTargetCatId} onChange={e => setBatchTargetCatId(e.target.value)}>
                  <option value="">Select Category</option>
                  {categories.filter(c => isSuperAdmin || c.id === allowedCatId).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <button type="button" onClick={handleBatchExecute} disabled={!batchAction}>Apply</button>
            </div>
          )}
        </>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <>
          {isSuperAdmin && (
            <div className="card">
              <h3>{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
              <form onSubmit={handleSaveCategory}>
                <input placeholder="Name" value={catName} onChange={e => setCatName(e.target.value)} required />
                <input placeholder="Emoji (e.g. ☕)" value={catEmoji} onChange={e => setCatEmoji(e.target.value)} />
                <textarea placeholder="Description" value={catDesc} onChange={e => setCatDesc(e.target.value)} rows={2} />
                <input type="number" placeholder="Sort Order" value={catSort} onChange={e => setCatSort(e.target.value)} />
                <div className="btn-group">
                  <button type="submit">{editingCategory ? 'Update' : 'Add'}</button>
                  {editingCategory && <button type="button" className="secondary" onClick={resetCategoryForm}>Cancel</button>}
                </div>
              </form>
            </div>
          )}

          <div className="card">
            <h3>All Categories</h3>
            {categories.map(c => (
              <div key={c.id} className="list-item">
                <div className="item-details">
                  <h4>{c.emoji} {c.name}</h4>
                  {c.description && <p>{c.description}</p>}
                </div>
                {isSuperAdmin ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="secondary" style={{ padding: '8px 12px' }} onClick={() => startEditCategory(c)}>Edit</button>
                    <button type="button" className="danger" style={{ padding: '8px 12px' }} onClick={() => deleteCategory(c.id)}>Del</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#888' }}>Read-only</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ADMINS TAB */}
      {activeTab === 'admins' && isSuperAdmin && (
        <>
          <div className="card">
            <h3>Add Admin</h3>
            <form onSubmit={handleSaveAdmin}>
              <input type="number" placeholder="Telegram User ID" value={adminId} onChange={e => setAdminId(e.target.value)} required />
              <select value={adminRole} onChange={e => setAdminRole(e.target.value)} required>
                <option value="super_admin">Super Admin</option>
                <option value="category_admin">Category Admin</option>
              </select>
              {adminRole === 'category_admin' && (
                <select value={adminCatId} onChange={e => setAdminCatId(e.target.value)} required>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <button type="submit">Add Admin</button>
            </form>
          </div>
          <div className="card">
            <h3>Current Admins</h3>
            {admins.map(a => {
              const cat = categories.find(c => c.id === a.categoryId);
              return (
                <div key={a.telegramId} className="list-item">
                  <div className="item-details">
                    <h4>ID: {a.telegramId}</h4>
                    <p>Role: {a.role} {cat ? `| Cat: ${cat.name}` : ''}</p>
                  </div>
                  <button type="button" className="danger" onClick={() => deleteAdmin(a.telegramId)}>Remove</button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && isSuperAdmin && (
        <div className="card settings-container">
          <h3>Bot Settings</h3>
          
          <form onSubmit={handleSaveSettings}>
            <div className="section">
              <h4>General Configurations</h4>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>About Text</label>
                <textarea 
                  value={settings.find(s => s.key === 'about')?.value || ''} 
                  onChange={e => updateSetting('about', e.target.value)} 
                  rows={4}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Instagram URL</label>
                <input 
                  type="text"
                  value={settings.find(s => s.key === 'instagram')?.value || ''} 
                  onChange={e => updateSetting('instagram', e.target.value)} 
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Contact Phone</label>
                <input 
                  type="text"
                  value={settings.find(s => s.key === 'phone')?.value || ''} 
                  onChange={e => updateSetting('phone', e.target.value)} 
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>AI Assistant Greeting</label>
                <textarea 
                  value={settings.find(s => s.key === 'ai_greeting')?.value || ''} 
                  onChange={e => updateSetting('ai_greeting', e.target.value)} 
                  rows={4}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff', boxSizing: 'border-box' }}
                  placeholder="پیام خوش‌آمدگویی دستیار هوشمند..."
                />
                <small style={{ color: '#888', fontSize: 11 }}>This text is shown when users click the AI Assistant button.</small>
              </div>
            </div>

            <div className="section" style={{ marginTop: '24px' }}>
              <h4>Custom Settings</h4>
              {settings.filter(s => !['about', 'instagram', 'phone'].includes(s.key)).map(s => (
                <div key={s.key} style={{ marginBottom: 12, display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>{s.key}</label>
                    <input value={s.value} onChange={e => updateSetting(s.key, e.target.value)} />
                  </div>
                  <button type="button" onClick={() => handleDeleteSetting(s.key)} style={{ background: '#ff4d4d', padding: '8px', marginTop: '20px', width: 'auto' }}>Delete</button>
                </div>
              ))}
            </div>

            <button type="submit" style={{ marginTop: '16px' }}>Save All Settings</button>
          </form>

          <hr style={{ margin: '24px 0', borderColor: '#444' }} />
          
          <h4>Add Custom Setting</h4>
          <form onSubmit={handleAddSetting} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Key</label>
              <input value={newSettingKey} onChange={e => setNewSettingKey(e.target.value)} placeholder="e.g. welcome_msg" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Value</label>
              <input value={newSettingValue} onChange={e => setNewSettingValue(e.target.value)} placeholder="Value" />
            </div>
            <button type="submit" style={{ background: '#28a745', width: 'auto' }}>Add</button>
          </form>

        </div>
      )}

      {/* MENU TAB */}
      {activeTab === 'menu' && isSuperAdmin && (
        <div className="card">
          <h3>Bot Menu Configuration</h3>

          {/* Section selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['drinks', 'beans', 'cakes', 'extras'] as const).map(s => (
              <button key={s} type="button"
                style={{ background: menuActiveSection === s ? '#4a9eff' : '#333', padding: '8px 16px', width: 'auto' }}
                onClick={() => setMenuActiveSection(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Items in this section */}
          {menuConfigs
            .filter((c: any) => c.menuSection === menuActiveSection)
            .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
            .map((config: any) => (
              <div key={config.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>
                      {config.categoryEmoji} {config.categoryName}
                      {!config.isVisible && <span style={{ color: '#888', fontSize: 12 }}> (hidden)</span>}
                    </h4>
                    {config.specialMessage && <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Has special empty-state message</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="secondary" style={{ padding: '6px 10px' }}
                      onClick={() => handleToggleMenuVisibility(config)}>
                      {config.isVisible ? '👁 Hide' : '👁 Show'}
                    </button>
                    <button type="button" className="secondary" style={{ padding: '6px 10px' }}
                      onClick={() => handleMenuReorder(config.id, 'up')}>↑</button>
                    <button type="button" className="secondary" style={{ padding: '6px 10px' }}
                      onClick={() => handleMenuReorder(config.id, 'down')}>↓</button>
                    <button type="button" className="danger" style={{ padding: '6px 10px' }}
                      onClick={() => handleDeleteMenuConfig(config.id)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}

          {/* Add to section */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Add category to {menuActiveSection}</label>
              <select value={menuAddCatId} onChange={e => setMenuAddCatId(e.target.value)}>
                <option value="">Select category...</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>
            </div>
            <button type="button" style={{ background: '#28a745', width: 'auto' }} onClick={handleAddToSection}>Add</button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="bottom-nav">
        <button className={`nav-item ${activeTab === 'products' ? 'active' : ''}`} onClick={() => { setActiveTab('products'); window.scrollTo(0,0); }}>
          Products
        </button>
        <button className={`nav-item ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => { setActiveTab('categories'); window.scrollTo(0,0); }}>
          Categories
        </button>
        {isSuperAdmin && (
          <>
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); window.scrollTo(0,0); }}>
              Settings
            </button>
            <button className={`nav-item ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => { setActiveTab('admins'); window.scrollTo(0,0); }}>
              Admins
            </button>
            <button className={`nav-item ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => { setActiveTab('menu'); window.scrollTo(0,0); }}>
              Menu
            </button>
          </>
        )}
      </div>
    </div>
  );
}
