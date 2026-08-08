import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import StatTile from '../components/StatTile';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';

type UserStateRow = {
  telegramId: string;
  firstSeenAt: number | string;
  lastSeenAt: number | string;
  visitsTotal: number;
  streakDays: number;
};

type SortKey = 'streakDays' | 'visitsTotal';
type SortDir = 'asc' | 'desc';

function toMillis(t: number | string): number {
  if (typeof t === 'number') return t;
  return Date.parse(t);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
}

export default function StreaksPage() {
  const { setError, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: queryKeys.streakConfig,
    queryFn: () => apiFetch<{ streakMessages: boolean; streakCronEnabled: boolean }>('/streaks/config'),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.streaks,
    queryFn: async () => {
      const res = await apiFetch<{ users: UserStateRow[] }>('/streaks');
      return res.users;
    },
  });

  const [sortKey, setSortKey] = useState<SortKey>('streakDays');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sortedUsers = useMemo(() => {
    if (!data) return [];
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => (a[sortKey] - b[sortKey]) * dir);
  }, [data, sortKey, sortDir]);

  if (isLoading) return <LoadingScreen />;
  if (error) {
    setError(error instanceof Error ? error.message : String(error));
  }

  const users = data ?? [];
  const topStreak = users.reduce((max, u) => Math.max(max, u.streakDays), 0);
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const todayKey = Math.floor(Date.now() / ONE_DAY_MS);
  const activeToday = users.filter(
    (u) => Math.floor(toMillis(u.lastSeenAt) / ONE_DAY_MS) === todayKey
  ).length;
  const med = median(users.map((u) => u.visitsTotal));

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  return (
    <>
      <div className="card">
        <h2>Streak Configuration</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={config?.streakMessages ?? false}
              onChange={(e) => {
                apiFetch('/streaks/config', { method: 'POST', body: { streakMessages: e.target.checked } })
                  .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.streakConfig }))
                  .catch((err) => setError(err.message));
              }}
            />
            Streak Messages
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={config?.streakCronEnabled ?? false}
              onChange={(e) => {
                apiFetch('/streaks/config', { method: 'POST', body: { streakCronEnabled: e.target.checked } })
                  .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.streakConfig }))
                  .catch((err) => setError(err.message));
              }}
            />
            Streak Sweep Cron
          </label>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatTile label="Users tracked" value={users.length} hint="all-time" />
          <StatTile label="Active today" value={activeToday} hint="UTC" />
          <StatTile label="Top streak" value={topStreak} hint="days" />
          <StatTile label="Median visits" value={med} hint="per user" />
        </div>
      </div>
      <div className="card">
        <h2>Users</h2>
        {users.length === 0 ? (
          <EmptyState message="User visit streaks will appear here once tracking is enabled." />
        ) : (
          <ul className="list">
            {sortedUsers.map((u) => (
              <li key={u.telegramId} className="list-item">
                <div className="list-item-info">
                  <span>{u.telegramId}</span>
                  <span className="list-item-meta">
                    visits {u.visitsTotal} · last {new Date(toMillis(u.lastSeenAt)).toLocaleDateString()}
                  </span>
                </div>
                <div className="list-item-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => toggleSort('streakDays')}
                  >
                    🔥 {u.streakDays}d
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () => {
                      if (!(await confirm(`Reset streak for ${u.telegramId}?`))) return;
                      await apiFetch('/streaks/reset', { method: 'POST', body: { telegramId: u.telegramId } });
                      void queryClient.invalidateQueries({ queryKey: queryKeys.streaks });
                    }}
                  >
                    ↺ Reset
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => toggleSort('visitsTotal')}
                  >
                    📈 {u.visitsTotal}
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
