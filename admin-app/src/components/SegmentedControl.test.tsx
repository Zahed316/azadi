import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';

// Mock the haptics hook
vi.mock('../hooks/useTelegramHaptics', () => ({
  useTelegramHaptics: () => ({
    tap: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    select: vi.fn(),
  }),
}));

const options = [
  { label: 'همه', value: 'all' },
  { label: 'موجود', value: 'available' },
  { label: 'ناموجود', value: 'unavailable' },
];

describe('SegmentedControl', () => {
  it('renders all options', () => {
    render(<SegmentedControl options={options} value="all" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'همه' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'موجود' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ناموجود' })).toBeInTheDocument();
  });

  it('marks the active option with aria-selected', () => {
    render(<SegmentedControl options={options} value="available" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'موجود' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'همه' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange when a non-active option is clicked', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'موجود' }));
    expect(onChange).toHaveBeenCalledWith('available');
  });

  it('does not call onChange when the active option is clicked', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'همه' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies active class to the selected option', () => {
    render(<SegmentedControl options={options} value="unavailable" onChange={vi.fn()} />);
    const activeBtn = screen.getByRole('tab', { name: 'ناموجود' });
    expect(activeBtn.className).toContain('active');
    const inactiveBtn = screen.getByRole('tab', { name: 'همه' });
    expect(inactiveBtn.className).not.toContain('active');
  });

  it('renders as a tablist with correct ARIA role', () => {
    render(<SegmentedControl options={options} value="all" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});
