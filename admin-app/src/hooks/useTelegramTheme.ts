import { useState, useEffect } from 'react';
import { themeParamsState, mountThemeParams, bindThemeParamsCssVars } from '@telegram-apps/sdk';

/**
 * Subscribes to Telegram theme parameters and binds --tg-theme-* CSS variables.
 *
 * Returns the current theme params object (bg_color, text_color, etc.).
 * Automatically mounts and binds on first render; cleans up on unmount.
 *
 * @example
 * ```tsx
 * const theme = useTelegramTheme();
 * <div style={{ color: theme?.text_color }}>Hello</div>
 * ```
 */
export function useTelegramTheme(): ReturnType<typeof themeParamsState> {
  const [theme, setTheme] = useState(themeParamsState);

  useEffect(() => {
    mountThemeParams();
    bindThemeParamsCssVars();

    return themeParamsState.sub((current) => {
      setTheme(current);
    });
  }, []);

  return theme;
}
