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
    queryFn: () =>
      apiFetch<{ streakMessages: boolean; streakCronEnabled: boolean }>('/streaks/config'),
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
    (u) => Math.floor(toMillis(u.lastSeenAt) / ONE_DAY_MS) === todayKey,
  ).length;
  const med = median(users.map((u) => u.visitsTotal));

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  return (
    <>
      <div className="card">
        <h2>تنظیمات استریک</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={config?.streakMessages ?? false}
              onChange={(e) => {
                void apiFetch('/streaks/config', {
                  method: 'POST',
                  body: { streakMessages: e.target.checked },
                })
                  .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.streakConfig }))
                  .catch((err: unknown) =>
                    setError(err instanceof Error ? err.message : String(err)),
                  );
              }}
            />
            پیام‌های استریک
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={config?.streakCronEnabled ?? false}
              onChange={(e) => {
                void apiFetch('/streaks/config', {
                  method: 'POST',
                  body: { streakCronEnabled: e.target.checked },
                })
                  .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.streakConfig }))
                  .catch((err: unknown) =>
                    setError(err instanceof Error ? err.message : String(err)),
                  );
              }}
            />
            کرون بروزرسانی استریک
          </label>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatTile label="کاربران ردیابی‌شده" value={users.length} hint="کل زمان" />
          <StatTile label="فعال امروز" value={activeToday} hint="UTC" />
          <StatTile label="بیشترین استریک" value={topStreak} hint="روز" />
          <StatTile label="میانه بازدید" value={med} hint="به ازای هر کاربر" />
        </div>
      </div>
      <div className="card">
        <h2>کاربران</h2>
        {users.length === 0 ? (
          <EmptyState message="استریک بازدید کاربران پس از فعال‌سازی ردیابی اینجا نمایش داده می‌شود." />
        ) : (
          <ul className="list">
            {sortedUsers.map((u) => (
              <li key={u.telegramId} className="list-item">
                <div className="list-item-info">
                  <span>{u.telegramId}</span>
                  <span className="list-item-meta">
                    بازدید {u.visitsTotal} · آخرین{' '}
                    {new Date(toMillis(u.lastSeenAt)).toLocaleDateString()}
                  </span>
                </div>
                <div className="list-item-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => toggleSort('streakDays')}
                  >
                    🔥 {u.streakDays} روز
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      void (async () => {
                        if (!(await confirm(`استریک کاربر ${u.telegramId} بازنشانی شود؟`))) return;
                        await apiFetch('/streaks/reset', {
                          method: 'POST',
                          body: { telegramId: u.telegramId },
                        });
                        void queryClient.invalidateQueries({ queryKey: queryKeys.streaks });
                      })();
                    }}
                  >
                    ↺ بازنشانی
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
