import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';
import Field from '../components/Field';

type AiLog = {
  id: number;
  userId: string;
  question: string;
  response: string;
  timestamp: number | string;
};

function formatTime(t: number | string): string {
  const d = typeof t === 'number' ? new Date(t) : new Date(t);
  return d.toLocaleString();
}

export default function AILogsPage() {
  const { setError } = useAppContext();
  const [userFilter, setUserFilter] = useState('');

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.aiLogs, userFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (userFilter) params.set('userId', userFilter);
      params.set('limit', '100');
      return apiFetch<{ logs: AiLog[] }>(`/ai-logs?${params}`).then((r) => r.logs);
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (error) setError((error as Error).message);

  return (
    <>
      <div className="card">
        <h2>AI Conversation Logs</h2>
        <Field label="Filter by User ID">
          <input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Telegram user ID (optional)"
          />
        </Field>
      </div>
      <div className="card">
        {logs.length === 0 ? (
          <EmptyState message="No AI logs yet." />
        ) : (
          <ul className="list">
            {logs.map((log) => (
              <li
                key={log.id}
                className="list-item"
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
              >
                <div className="list-item-info" style={{ width: '100%' }}>
                  <span style={{ fontWeight: 600 }}>{log.userId}</span>
                  <span className="list-item-meta">{formatTime(log.timestamp)}</span>
                </div>
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    Q: <span dir="auto">{log.question}</span>
                  </div>
                  <div style={{ fontSize: '0.85em', marginTop: 4 }}>
                    A: <span dir="auto">{log.response}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
