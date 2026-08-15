import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from '../api/client';

// Mock the module-level API_BASE import by mocking fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('unwraps envelope key when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => ({ products: [{ id: 1, name: 'Latte' }] }),
    });

    const result = await apiFetch<{ id: number; name: string }[]>('/products', 'products');
    expect(result).toEqual([{ id: 1, name: 'Latte' }]);
  });

  it('returns raw JSON when no envelope key is provided', async () => {
    const payload = { status: 'ok', db: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => payload,
    });

    const result = await apiFetch('/health');
    expect(result).toEqual(payload);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => 'Not Found',
    });

    await expect(apiFetch('/missing')).rejects.toThrow('Not Found');
  });

  it('throws generic error when response body is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => '',
    });

    await expect(apiFetch('/error')).rejects.toThrow('HTTP 500');
  });

  it('sends correct URL with API_BASE prefix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => ({}),
    });

    await apiFetch('/categories', 'categories');
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/categories'));
  });
});
