import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App smoke test', () => {
  it('renders without crashing', () => {
    // App includes its own BrowserRouter — render directly
    render(<App />);
    expect(document.querySelector('.container')).toBeInTheDocument();
  });
});
