import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Icon from './Icon';
import IconSprite from './IconSprite';

function WithSprite({ children }: { children: React.ReactNode }) {
  return (
    <>
      <IconSprite />
      {children}
    </>
  );
}

describe('Icon', () => {
  it('renders an SVG with the correct use href', () => {
    render(
      <WithSprite>
        <Icon name="check" />
      </WithSprite>,
    );

    const use = screen.getByText('', { selector: 'use' });
    expect(use).toHaveAttribute('href', '#icon-check');
  });

  it('applies custom size', () => {
    render(
      <WithSprite>
        <Icon name="edit" size={32} />
      </WithSprite>,
    );

    const use = screen.getByText('', { selector: 'use' });
    const svg = use.closest('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it('applies className', () => {
    render(
      <WithSprite>
        <Icon name="trash" className="my-class" />
      </WithSprite>,
    );

    const use = screen.getByText('', { selector: 'use' });
    const svg = use.closest('svg');
    expect(svg).toHaveClass('my-class');
  });

  it('renders the hidden sprite block with symbols', () => {
    const { container } = render(<IconSprite />);

    const sprite = container.querySelector('svg[aria-hidden="true"]');
    expect(sprite).toBeInTheDocument();

    const symbols = sprite!.querySelectorAll('symbol');
    expect(symbols.length).toBe(23);
  });
});
