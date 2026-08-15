import { useState, useEffect } from 'react';
import { themeParams } from '@tma.js/sdk';

/**
 * Subscribes to Telegram theme parameters and binds --tg-theme-* CSS variables.
 *
 * Returns the current theme params object (bgColor, textColor, etc.).
 * Automatically mounts and binds on first render; cleans up on unmount.
 *
 * @example
 * ```tsx
 * const theme = useTelegramTheme();
 * <div style={{ color: theme?.textColor }}>Hello</div>
 * ```
 */
export function useTelegramTheme() {
  const [theme, setTheme] = useState(themeParams.state);

  useEffect(() => {
    themeParams.mount();
    themeParams.bindCssVars();

    return themeParams.state.sub((current) => {
      setTheme(current);
    });
  }, []);

  return theme;
}
