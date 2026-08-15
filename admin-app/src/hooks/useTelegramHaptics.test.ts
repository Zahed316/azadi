import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@telegram-apps/sdk', () => ({
  hapticFeedback: {
    isSupported: vi.fn(() => true),
    impactOccurred: vi.fn(),
    notificationOccurred: vi.fn(),
    selectionChanged: vi.fn(),
  },
}));

import { hapticFeedback } from '@telegram-apps/sdk';

const mockHaptic = vi.mocked(hapticFeedback);

describe('useTelegramHaptics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHaptic.isSupported.mockReturnValue(true);
  });

  it('tap calls impactOccurred with light', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useTelegramHaptics } = await import('./useTelegramHaptics');

    const { result } = renderHook(() => useTelegramHaptics());
    result.current.tap();

    expect(mockHaptic.impactOccurred).toHaveBeenCalledWith('light');
  });

  it('success calls notificationOccurred with success', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useTelegramHaptics } = await import('./useTelegramHaptics');

    const { result } = renderHook(() => useTelegramHaptics());
    result.current.success();

    expect(mockHaptic.notificationOccurred).toHaveBeenCalledWith('success');
  });

  it('error calls notificationOccurred with error', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useTelegramHaptics } = await import('./useTelegramHaptics');

    const { result } = renderHook(() => useTelegramHaptics());
    result.current.error();

    expect(mockHaptic.notificationOccurred).toHaveBeenCalledWith('error');
  });

  it('select calls selectionChanged', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useTelegramHaptics } = await import('./useTelegramHaptics');

    const { result } = renderHook(() => useTelegramHaptics());
    result.current.select();

    expect(mockHaptic.selectionChanged).toHaveBeenCalled();
  });

  it('no-ops when hapticFeedback is not supported', async () => {
    mockHaptic.isSupported.mockReturnValue(false);

    const { renderHook } = await import('@testing-library/react');
    const { useTelegramHaptics } = await import('./useTelegramHaptics');

    const { result } = renderHook(() => useTelegramHaptics());
    result.current.tap();
    result.current.success();
    result.current.error();
    result.current.select();

    expect(mockHaptic.impactOccurred).not.toHaveBeenCalled();
    expect(mockHaptic.notificationOccurred).not.toHaveBeenCalled();
    expect(mockHaptic.selectionChanged).not.toHaveBeenCalled();
  });
});
