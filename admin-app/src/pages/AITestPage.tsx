import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import Field from '../components/Field';

export default function AITestPage() {
  const { setError, showToast } = useAppContext();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Array<{ q: string; a: string; ts: Date }>>([]);

  const testMutation = useMutation({
    mutationFn: (q: string) =>
      apiFetch<{ response: string }>('/ai-test', { method: 'POST', body: { query: q } }),
    onSuccess: (data, variables) => {
      setHistory((prev) => [{ q: variables, a: data.response, ts: new Date() }, ...prev]);
      setQuery('');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    testMutation.mutate(query);
  };

  return (
    <>
      <div className="card">
        <h2>AI Chat Test</h2>
        <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
          Send a test query to the AI assistant. Uses the same context as the bot.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <Field label="Test Query">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. What do you recommend?"
              dir="auto"
              style={{ flex: 1 }}
            />
          </Field>
          <button type="submit" className="primary" disabled={testMutation.isPending}>
            {testMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h2>Results</h2>
          <ul className="list">
            {history.map((item, i) => (
              <li
                key={`${item.ts.getTime()}-${i}`}
                className="list-item"
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9em' }}>
                    Q: <span dir="auto">{item.q}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: '0.9em' }}>
                    A: <span dir="auto">{item.a}</span>
                  </div>
                  <div style={{ fontSize: '0.75em', color: '#aaa', marginTop: 2 }}>
                    {item.ts.toLocaleTimeString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
