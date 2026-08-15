import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ThemeParams } from '@telegram-apps/bridge';

type MockThemeParamsState = ReturnType<typeof vi.fn<() => ThemeParams>> & {
  sub: ReturnType<typeof vi.fn>;
};

vi.mock('@telegram-apps/sdk', () => {
  const unsubFn = vi.fn();
  const state = vi.fn(() => ({
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    link_color: '#3399ec',
    button_color: '#3399ec',
    button_text_color: '#ffffff',
    secondary_bg_color: '#f0f0f0',
  })) as MockThemeParamsState;
  state.sub = vi.fn(() => unsubFn);

  return {
    themeParamsState: state,
    mountThemeParams: vi.fn(),
    bindThemeParamsCssVars: vi.fn(() => unsubFn),
  };
});

import { themeParamsState, mountThemeParams, bindThemeParamsCssVars } from '@telegram-apps/sdk';
import { renderHook } from '@testing-library/react';
import { useTelegramTheme } from './useTelegramTheme';

const mockThemeParamsState = themeParamsState as unknown as MockThemeParamsState;
const mockMountThemeParams = vi.mocked(mountThemeParams);
const mockBindThemeParamsCssVars = vi.mocked(bindThemeParamsCssVars);

describe('useTelegramTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThemeParamsState.mockReturnValue({
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#999999',
      link_color: '#3399ec',
      button_color: '#3399ec',
      button_text_color: '#ffffff',
      secondary_bg_color: '#f0f0f0',
    });
  });

  it('calls mountThemeParams on mount', () => {
    renderHook(() => useTelegramTheme());
    expect(mockMountThemeParams).toHaveBeenCalledTimes(1);
  });

  it('calls bindThemeParamsCssVars on mount', () => {
    renderHook(() => useTelegramTheme());
    expect(mockBindThemeParamsCssVars).toHaveBeenCalledTimes(1);
  });

  it('returns current theme params from themeParamsState', () => {
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

  it('subscribes to themeParamsState changes', () => {
    renderHook(() => useTelegramTheme());
    expect(mockThemeParamsState.sub).toHaveBeenCalledTimes(1);
  });

  it('cleans up subscription on unmount', () => {
    const unsubFn = vi.fn();
    mockThemeParamsState.sub.mockReturnValueOnce(unsubFn);

    const { unmount } = renderHook(() => useTelegramTheme());
    unmount();
    expect(unsubFn).toHaveBeenCalledTimes(1);
  });
});
