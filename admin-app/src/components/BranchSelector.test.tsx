import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BranchSelector from './BranchSelector';

const branches = [
  { id: 1, name: 'شعبه اول' },
  { id: 2, name: 'شعبه دوم' },
];

describe('BranchSelector', () => {
  it('renders with "all branches" label when selectedId is null', () => {
    render(<BranchSelector branches={branches} selectedId={null} onChange={vi.fn()} />);

    expect(screen.getByText(/همه شعب/)).toBeInTheDocument();
  });

  it('renders selected branch name when a branch is selected', () => {
    render(<BranchSelector branches={branches} selectedId={1} onChange={vi.fn()} />);

    expect(screen.getByText(/شعبه اول/)).toBeInTheDocument();
  });

  it('opens dropdown when trigger is clicked', () => {
    render(<BranchSelector branches={branches} selectedId={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('shows all branches and "all" option in dropdown', () => {
    render(<BranchSelector branches={branches} selectedId={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));

    expect(screen.getByRole('option', { name: 'همه شعب' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'شعبه اول' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'شعبه دوم' })).toBeInTheDocument();
  });

  it('calls onChange with null when "all branches" is selected', () => {
    const onChange = vi.fn();
    render(<BranchSelector branches={branches} selectedId={1} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByRole('option', { name: 'همه شعب' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with branch id when a branch is selected', () => {
    const onChange = vi.fn();
    render(<BranchSelector branches={branches} selectedId={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByRole('option', { name: 'شعبه دوم' }));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('closes dropdown after selection', () => {
    render(<BranchSelector branches={branches} selectedId={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'شعبه اول' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <BranchSelector branches={branches} selectedId={null} onChange={vi.fn()} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('highlights active branch in dropdown', () => {
    render(<BranchSelector branches={branches} selectedId={2} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));

    const allOption = screen.getByRole('option', { name: 'همه شعب' });
    const branch2Option = screen.getByRole('option', { name: 'شعبه دوم' });

    expect(allOption).not.toHaveClass('active');
    expect(branch2Option).toHaveClass('active');
  });
});
