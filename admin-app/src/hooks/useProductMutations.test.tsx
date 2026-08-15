import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
}));
vi.mock('../api/keys', () => ({
  queryKeys: { products: ['products'] },
}));

import { apiFetch } from '../api/client';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useToggleProductField', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes field=available to /products/:id/toggle', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });
    const { renderHook, act, waitFor } = await import('@testing-library/react');
    const { useToggleProductField } = await import('./useProductMutations');

    const { result } = renderHook(() => useToggleProductField(), { wrapper });

    act(() => {
      result.current.mutate({ id: 7, field: 'available', value: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetch).toHaveBeenCalledWith('/products/7/toggle', {
      method: 'PUT',
      body: { available: true },
    });
  });

  it('routes other fields to PUT /products/:id', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });
    const { renderHook, act, waitFor } = await import('@testing-library/react');
    const { useToggleProductField } = await import('./useProductMutations');

    const { result } = renderHook(() => useToggleProductField(), { wrapper });

    act(() => {
      result.current.mutate({ id: 7, field: 'featured', value: false });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetch).toHaveBeenCalledWith('/products/7', {
      method: 'PUT',
      body: { featured: false },
    });
  });
});
