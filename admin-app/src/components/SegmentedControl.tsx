import { useRef, useEffect, useState } from 'react';
import { useTelegramHaptics } from '../hooks/useTelegramHaptics';

interface SegmentedControlOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const haptics = useTelegramHaptics();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(
    null,
  );

  const updateIndicator = () => {
    const container = containerRef.current;
    const activeButton = buttonRefs.current.get(value);
    if (container && activeButton) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    updateIndicator();
  }, [value]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      updateIndicator();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleClick = (opt: SegmentedControlOption) => {
    if (opt.value !== value) {
      haptics.tap();
      onChange(opt.value);
    }
  };

  return (
    <div ref={containerRef} className="segmented-control" role="tablist" aria-label="انتخاب">
      {indicatorStyle && (
        <span
          className="segmented-control-indicator"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
      )}
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              if (el) {
                buttonRefs.current.set(opt.value, el);
              } else {
                buttonRefs.current.delete(opt.value);
              }
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`segmented-control-option${isActive ? ' active' : ''}`}
            onClick={() => handleClick(opt)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
