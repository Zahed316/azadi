import { useState, useRef, useCallback, useEffect } from 'react';
import { useTelegramHaptics } from '../hooks/useTelegramHaptics';

interface InlineStockEditorProps {
  value: number;
  onChange: (n: number) => void;
  onZero?: () => void;
}

const UNLIMITED_VALUE = 999_999;

/**
 * Compact inline stock editor with +/- buttons and long-press menu.
 *
 * - Tap +/- to adjust stock by 1
 * - Long-press the number to open a quick-set menu (zero / unlimited)
 * - When stock reaches zero, `onZero` fires (panic-zero: auto-hide product)
 */
export default function InlineStockEditor({ value, onChange, onZero }: InlineStockEditorProps) {
  const { tap, success, select } = useTelegramHaptics();
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  const handleDecrement = useCallback(() => {
    tap();
    const next = Math.max(0, value - 1);
    onChange(next);
    if (next === 0) onZero?.();
  }, [value, onChange, onZero, tap]);

  const handleIncrement = useCallback(() => {
    tap();
    onChange(value + 1);
  }, [value, onChange, tap]);

  const handleLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      select();
      setMenuOpen(true);
    }, 500);
  }, [select]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const setZero = useCallback(() => {
    setMenuOpen(false);
    success();
    onChange(0);
    onZero?.();
  }, [onChange, onZero, success]);

  const setUnlimited = useCallback(() => {
    setMenuOpen(false);
    success();
    onChange(UNLIMITED_VALUE);
  }, [onChange, success]);

  const displayStock = value >= UNLIMITED_VALUE ? '∞' : value;

  return (
    <div className="inline-stock-editor">
      <button
        type="button"
        className="inline-stock-btn inline-stock-minus"
        onClick={handleDecrement}
        disabled={value <= 0}
        aria-label="کاهش موجودی"
      >
        −
      </button>

      <button
        type="button"
        className="inline-stock-value"
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        aria-label="موجودی فعلی — نگه دارید برای گزینه‌ها"
      >
        {displayStock}
      </button>

      <button
        type="button"
        className="inline-stock-btn inline-stock-plus"
        onClick={handleIncrement}
        aria-label="افزایش موجودی"
      >
        +
      </button>

      {menuOpen && (
        <div ref={menuRef} className="inline-stock-menu" role="menu">
          <button
            type="button"
            className="inline-stock-menu-item"
            role="menuitem"
            onClick={setZero}
          >
            صفر
          </button>
          <button
            type="button"
            className="inline-stock-menu-item"
            role="menuitem"
            onClick={setUnlimited}
          >
            نامحدود
          </button>
        </div>
      )}
    </div>
  );
}
