import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProductImage from './ProductImage';

describe('ProductImage', () => {
  it('renders an img when src is provided', () => {
    render(<ProductImage src="https://example.com/photo.jpg" alt="Latte" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(img).toHaveAttribute('alt', 'Latte');
  });

  it('renders monogram fallback when src is null', () => {
    render(<ProductImage src={null} alt="Latte" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('renders monogram fallback when src is undefined', () => {
    render(<ProductImage alt="Cappuccino" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('switches to monogram on image load error', () => {
    render(<ProductImage src="https://example.com/broken.jpg" alt="Mocha" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/broken.jpg');

    fireEvent.error(img);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('uses ? when alt text is empty', () => {
    render(<ProductImage src={null} alt="" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('applies className to the img element', () => {
    render(
      <ProductImage src="https://example.com/photo.jpg" alt="Espresso" className="hero-img" />,
    );
    expect(screen.getByRole('img')).toHaveClass('hero-img');
  });

  it('applies className to the fallback div', () => {
    const { container } = render(<ProductImage src={null} alt="Espresso" className="hero-img" />);
    const fallback = container.querySelector('[aria-hidden="true"]');
    expect(fallback).toHaveClass('hero-img');
  });
});
