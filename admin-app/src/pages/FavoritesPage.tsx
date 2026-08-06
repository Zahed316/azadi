import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import StatTile from '../components/StatTile';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';

type FavoriteRow = {
  telegramId: string;
  productId: number;
  productName: string | null;
  favoritedAt: number | string;
};

type GroupBy = 'user' | 'product';

function toMillis(t: number | string): number {
  if (typeof t === 'number') return t;
  return Date.parse(t);
}

export default function FavoritesPage() {
  const { setError, showToast, confirm, currentUser } = useAppContext();
  const queryClient = useQueryClient();
  const [groupBy, setGroupBy] = useState<GroupBy>('user');

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.favorites, groupBy],
    queryFn: async () => {
      const res = await apiFetch<{ favorites: FavoriteRow[] }>(`/favorites?groupBy=${groupBy}`);
      return res.favorites;
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ telegramId, productId }: { telegramId: string; productId: number }) =>
      apiFetch<{ ok: boolean }>(`/favorites/${encodeURIComponent(telegramId)}/${productId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
      // Audit log: stdout only. No persistent audit table by design.
      console.info('favorites: removed', {
        telegramId: vars.telegramId,
        productId: vars.productId,
        by: currentUser?.telegramId,
        at: new Date().toISOString(),
      });
      showToast('Favorite removed ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const grouped = useMemo(() => {
    if (!data) return [];
    if (groupBy === 'user') {
      const map = new Map<string, { count: number; lastFavorited: number }>();
      for (const f of data) {
        const ts = toMillis(f.favoritedAt);
        const cur = map.get(f.telegramId);
        if (!cur) map.set(f.telegramId, { count: 1, lastFavorited: ts });
        else {
          cur.count++;
          cur.lastFavorited = Math.max(cur.lastFavorited, ts);
        }
      }
      return Array.from(map.entries())
        .map(([telegramId, v]) => ({ telegramId, ...v }))
        .sort((a, b) => b.lastFavorited - a.lastFavorited);
    } else {
      const map = new Map<number, { productName: string | null; count: number; lastFavorited: number }>();
      for (const f of data) {
        const ts = toMillis(f.favoritedAt);
        const cur = map.get(f.productId);
        if (!cur) map.set(f.productId, { productName: f.productName, count: 1, lastFavorited: ts });
        else {
          cur.count++;
          cur.lastFavorited = Math.max(cur.lastFavorited, ts);
        }
      }
      return Array.from(map.entries())
        .map(([productId, v]) => ({ productId, ...v }))
        .sort((a, b) => b.count - a.count);
    }
  }, [data, groupBy]);

  const handleRemove = async (telegramId: string, productId: number) => {
    if (!(await confirm('Remove this favorite?'))) return;
    removeMutation.mutate({ telegramId, productId });
  };

  if (isLoading) return <LoadingScreen />;
  if (error) {
    setError((error as Error).message);
  }

  const favorites = data ?? [];
  const totalFavorites = favorites.length;
  const uniqueUsers = new Set(favorites.map((f) => f.telegramId)).size;
  const uniqueProducts = new Set(favorites.map((f) => f.productId)).size;

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatTile label="Total favorites" value={totalFavorites} />
          <StatTile label="Unique users" value={uniqueUsers} />
          <StatTile label="Unique products" value={uniqueProducts} />
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <strong>Group by:</strong>
          <button
            type="button"
            className={groupBy === 'user' ? 'primary' : 'secondary'}
            onClick={() => setGroupBy('user')}
          >
            User
          </button>
          <button
            type="button"
            className={groupBy === 'product' ? 'primary' : 'secondary'}
            onClick={() => setGroupBy('product')}
          >
            Product
          </button>
        </div>
        {favorites.length === 0 ? (
          <EmptyState message="0 مورد علاقه ثبت نشده است" />
        ) : groupBy === 'user' ? (
          <ul className="list">
            {(grouped as Array<{ telegramId: string; count: number; lastFavorited: number }>).map(
              (g) => (
                <li key={g.telegramId} className="list-item">
                  <div className="list-item-info">
                    <span>{g.telegramId}</span>
                    <span className="list-item-meta">
                      {g.count} favorite{g.count === 1 ? '' : 's'} · last{' '}
                      {new Date(g.lastFavorited).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ),
            )}
          </ul>
        ) : (
          <ul className="list">
            {favorites
              .slice()
              .sort((a, b) => toMillis(b.favoritedAt) - toMillis(a.favoritedAt))
              .map((f) => (
                <li key={`${f.telegramId}-${f.productId}`} className="list-item">
                  <div className="list-item-info">
                    <span dir="auto">{f.productName ?? `(deleted #${f.productId})`}</span>
                    <span className="list-item-meta">
                      {f.telegramId} · {new Date(toMillis(f.favoritedAt)).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="list-item-actions">
                    <button
                      type="button"
                      className="danger"
                      disabled={removeMutation.isPending}
                      onClick={() => handleRemove(f.telegramId, f.productId)}
                    >
                      Remove
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
