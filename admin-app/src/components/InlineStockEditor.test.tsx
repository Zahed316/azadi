import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InlineStockEditor from './InlineStockEditor';

// Mock the haptics hook
vi.mock('../hooks/useTelegramHaptics', () => ({
  useTelegramHaptics: () => ({
    tap: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    select: vi.fn(),
  }),
}));

describe('InlineStockEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the current stock value', () => {
    render(<InlineStockEditor value={5} onChange={vi.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders infinity symbol for unlimited stock', () => {
    render(<InlineStockEditor value={999999} onChange={vi.fn()} />);
    expect(screen.getByText('∞')).toBeInTheDocument();
  });

  it('calls onChange with incremented value on + tap', async () => {
    const onChange = vi.fn();
    render(<InlineStockEditor value={3} onChange={onChange} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByLabelText('افزایش موجودی'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('calls onChange with decremented value on - tap', async () => {
    const onChange = vi.fn();
    render(<InlineStockEditor value={5} onChange={onChange} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByLabelText('کاهش موجودی'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('does not go below 0', async () => {
    const onChange = vi.fn();
    render(<InlineStockEditor value={0} onChange={onChange} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByLabelText('کاهش موجودی'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables - button when value is 0', () => {
    render(<InlineStockEditor value={0} onChange={vi.fn()} />);
    expect(screen.getByLabelText('کاهش موجودی')).toBeDisabled();
  });

  it('calls onZero when decrementing to 0', async () => {
    const onZero = vi.fn();
    const onChange = vi.fn();
    render(<InlineStockEditor value={1} onChange={onChange} onZero={onZero} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByLabelText('کاهش موجودی'));
    expect(onChange).toHaveBeenCalledWith(0);
    expect(onZero).toHaveBeenCalled();
  });

  it('opens long-press menu after 500ms hold', () => {
    render(<InlineStockEditor value={5} onChange={vi.fn()} />);
    const numberBtn = screen.getByLabelText('موجودی فعلی — نگه دارید برای گزینه‌ها');

    act(() => {
      fireEvent.mouseDown(numberBtn);
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'صفر' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'نامحدود' })).toBeInTheDocument();
  });

  it('does not open menu on short press', () => {
    render(<InlineStockEditor value={5} onChange={vi.fn()} />);
    const numberBtn = screen.getByLabelText('موجودی فعلی — نگه دارید برای گزینه‌ها');

    act(() => {
      fireEvent.mouseDown(numberBtn);
      vi.advanceTimersByTime(200);
      fireEvent.mouseUp(numberBtn);
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('sets stock to zero via menu', () => {
    const onChange = vi.fn();
    render(<InlineStockEditor value={10} onChange={onChange} />);
    const numberBtn = screen.getByLabelText('موجودی فعلی — نگه دارید برای گزینه‌ها');

    // Open menu via long-press
    act(() => {
      fireEvent.mouseDown(numberBtn);
      vi.advanceTimersByTime(500);
    });

    act(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'صفر' }));
    });

    expect(onChange).toHaveBeenCalledWith(0);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onZero when setting zero via menu', () => {
    const onZero = vi.fn();
    const onChange = vi.fn();
    render(<InlineStockEditor value={10} onChange={onChange} onZero={onZero} />);
    const numberBtn = screen.getByLabelText('موجودی فعلی — نگه دارید برای گزینه‌ها');

    act(() => {
      fireEvent.mouseDown(numberBtn);
      vi.advanceTimersByTime(500);
    });

    act(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'صفر' }));
    });

    expect(onZero).toHaveBeenCalled();
  });

  it('sets unlimited via menu', () => {
    const onChange = vi.fn();
    render(<InlineStockEditor value={5} onChange={onChange} />);
    const numberBtn = screen.getByLabelText('موجودی فعلی — نگه دارید برای گزینه‌ها');

    act(() => {
      fireEvent.mouseDown(numberBtn);
      vi.advanceTimersByTime(500);
    });

    act(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'نامحدود' }));
    });

    expect(onChange).toHaveBeenCalledWith(999999);
  });

  it('closes menu on outside click', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <InlineStockEditor value={5} onChange={vi.fn()} />
      </div>,
    );
    const numberBtn = screen.getByLabelText('موجودی فعلی — نگه دارید برای گزینه‌ها');

    act(() => {
      fireEvent.mouseDown(numberBtn);
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('menu')).toBeInTheDocument();

    act(() => {
      fireEvent.mouseDown(screen.getByTestId('outside'));
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('cleans up long-press timer on unmount', () => {
    const { unmount } = render(<InlineStockEditor value={5} onChange={vi.fn()} />);
    const numberBtn = screen.getByLabelText('موجودی فعلی — نگه دارید برای گزینه‌ها');

    fireEvent.mouseDown(numberBtn);
    unmount();

    // Advance past the timer — should not throw
    expect(() => vi.advanceTimersByTime(600)).not.toThrow();
  });

  it('cancels long-press if finger moves off button', () => {
    render(<InlineStockEditor value={5} onChange={vi.fn()} />);
    const numberBtn = screen.getByLabelText('موجودی فعلی — نگه دارید برای گزینه‌ها');

    act(() => {
      fireEvent.mouseDown(numberBtn);
      vi.advanceTimersByTime(300);
      fireEvent.mouseLeave(numberBtn);
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
