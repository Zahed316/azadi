import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tma.js/sdk', () => {
  const unsubFn = vi.fn();
  const state = {
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    link_color: '#3399ec',
    button_color: '#3399ec',
    button_text_color: '#ffffff',
    secondary_bg_color: '#f0f0f0',
  };
  const stateObj = Object.assign(
    vi.fn(() => state),
    { sub: vi.fn(() => unsubFn) },
  );

  return {
    themeParams: {
      state: stateObj,
      mount: vi.fn(),
      bindCssVars: vi.fn(() => unsubFn),
    },
  };
});

import { themeParams } from '@tma.js/sdk';
import { renderHook } from '@testing-library/react';
import { useTelegramTheme } from './useTelegramTheme';

const mockThemeParams = vi.mocked(themeParams);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- mock
const mockState: { sub: ReturnType<typeof vi.fn> } = mockThemeParams.state as any;

describe('useTelegramTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls mount on mount', () => {
    renderHook(() => useTelegramTheme());
    expect(mockThemeParams.mount).toHaveBeenCalledTimes(1);
  });

  it('calls bindCssVars on mount', () => {
    renderHook(() => useTelegramTheme());
    expect(mockThemeParams.bindCssVars).toHaveBeenCalledTimes(1);
  });

  it('returns current theme params from state', () => {
    const { result } = renderHook(() => useTelegramTheme());
    expect(result.current).toEqual({
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#999999',
      link_color: '#3399ec',
      button_color: '#3399ec',
      button_text_color: '#ffffff',
      secondary_bg_color: '#f0f0f0',
    });
  });

  it('subscribes to state changes', () => {
    renderHook(() => useTelegramTheme());
    expect(mockState.sub).toHaveBeenCalledTimes(1);
  });

  it('cleans up subscription on unmount', () => {
    const unsubFn = vi.fn();
    mockState.sub.mockReturnValueOnce(unsubFn);

    const { unmount } = renderHook(() => useTelegramTheme());
    unmount();
    expect(unsubFn).toHaveBeenCalledTimes(1);
  });
});
