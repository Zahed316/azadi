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

  const {
    data: logs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [...queryKeys.aiLogs, userFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (userFilter) params.set('userId', userFilter);
      params.set('limit', '100');
      return apiFetch<{ logs: AiLog[] }>(`/ai-logs?${params}`).then((r) => r.logs);
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (error) setError(error instanceof Error ? error.message : String(error));

  return (
    <>
      <div className="card">
        <h2>گزارش‌های مکالمه هوش مصنوعی</h2>
        <Field label="فیلتر بر اساس آیدی کاربر">
          <input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="آیدی تلگرام کاربر (اختیاری)"
          />
        </Field>
      </div>
      <div className="card">
        {logs.length === 0 ? (
          <EmptyState message="گزارش‌های مکالمه هوش مصنوعی با تعامل کاربران با ربات نمایش داده می‌شود." />
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
                  <div className="text-sm text-muted">
                    س: <span dir="auto">{log.question}</span>
                  </div>
                  <div className="text-sm mt-4">
                    ج: <span dir="auto">{log.response}</span>
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
