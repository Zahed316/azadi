import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <h2>⚠️ خطایی رخ داد</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            {this.state.error?.message || 'خطای غیرمنتظره‌ای رخ داد'}
          </p>
          <button className="primary" onClick={() => this.setState({ hasError: false, error: null })}>
            تلاش مجدد
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
