import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello() {
  return <h1>سلام</h1>;
}

describe('smoke', () => {
  it('renders a component', () => {
    render(<Hello />);
    expect(screen.getByRole('heading')).toHaveTextContent('سلام');
  });
});
