import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';

export default function ContentPage() {
  const { setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<{ settings: any[] }>('/settings').then(r => r.settings),
  });

  const { data: faqs = [] } = useQuery({
    queryKey: queryKeys.faqs,
    queryFn: () => apiFetch<{ faqs: any[] }>('/faqs').then(r => r.faqs),
  });

  const aboutSetting = settings.find((s: any) => s.key === 'about');
  const [aboutText, setAboutText] = useState(aboutSetting?.value || '');

  // Sync aboutText when settings query loads (handles initial load after mount)
  const [initialized, setInitialized] = useState(false);
  if (!initialized && aboutSetting) {
    setAboutText(aboutSetting.value || '');
    setInitialized(true);
  }

  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  const saveAboutMutation = useMutation({
    mutationFn: (body: any) => apiFetch('/settings', { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      showToast('About text saved ✓');
    },
    onError: (err: Error) => { setError(err.message); showToast(err.message, 'error'); },
  });

  const saveFaqMutation = useMutation({
    mutationFn: (data: { method: string; id?: number; body: any }) =>
      apiFetch(data.id ? `/faqs/${data.id}` : '/faqs', {
        method: data.method,
        body: data.body,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.faqs });
      resetFaqForm();
      showToast(variables.id ? 'FAQ updated ✓' : 'FAQ added ✓');
    },
    onError: (err: Error) => { setError(err.message); showToast(err.message, 'error'); },
  });

  const deleteFaqMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/faqs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.faqs });
      showToast('FAQ deleted ✓');
    },
    onError: (err: Error) => { setError(err.message); showToast(err.message, 'error'); },
  });

  const handleSaveAbout = () => {
    const updatedSettings = settings.map((s: any) =>
      s.key === 'about' ? { ...s, value: aboutText } : s
    );
    if (!updatedSettings.find((s: any) => s.key === 'about')) {
      updatedSettings.push({ key: 'about', value: aboutText });
    }
    saveAboutMutation.mutate({ settings: updatedSettings });
  };

  const handleSaveFaq = (e: React.FormEvent) => {
    e.preventDefault();
    saveFaqMutation.mutate({
      method: editingFaq ? 'PUT' : 'POST',
      id: editingFaq?.id,
      body: { question: faqQuestion, answer: faqAnswer },
    });
  };

  const deleteFaq = async (id: number) => {
    if (!(await confirm('Delete this FAQ?'))) return;
    deleteFaqMutation.mutate(id);
  };

  const startEditFaq = (f: any) => {
    setEditingFaq(f);
    setFaqQuestion(f.question);
    setFaqAnswer(f.answer);
  };

  const resetFaqForm = () => {
    setEditingFaq(null);
    setFaqQuestion('');
    setFaqAnswer('');
  };

  return (
    <>
      <div className="card">
        <h2>About Us</h2>
        <textarea value={aboutText} onChange={e => setAboutText(e.target.value)} rows={6} dir="auto" />
        <button className="primary" onClick={handleSaveAbout}>Save About Text</button>
      </div>

      <div className="card">
        <h2>{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</h2>
        <form onSubmit={handleSaveFaq}>
          <Field label="Question"><input value={faqQuestion} onChange={e => setFaqQuestion(e.target.value)} dir="auto" required /></Field>
          <Field label="Answer"><textarea value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} dir="auto" required /></Field>
          <button type="submit" className="primary">{editingFaq ? 'Update' : 'Add'} FAQ</button>
          {editingFaq && <button type="button" className="secondary" onClick={resetFaqForm}>Cancel</button>}
        </form>
      </div>

      <div className="card">
        <h2>FAQs</h2>
        {faqs.length === 0 ? <EmptyState message="No FAQs yet." /> : (
          <ul className="list">
            {faqs.map(f => (
              <li key={f.id} className="list-item">
                <div className="list-item-info">
                  <span dir="auto">{f.question}</span>
                </div>
                <div className="list-item-actions">
                  <button className="secondary" onClick={() => startEditFaq(f)}>Edit</button>
                  <button className="danger" onClick={() => deleteFaq(f.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
