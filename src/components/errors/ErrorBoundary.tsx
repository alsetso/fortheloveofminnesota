'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import PageWrapper from '../layout/PageWrapper';
import { ErrorContent } from './ErrorContent';

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Show toast if available
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('show-error-toast', {
        detail: { message: error.message || 'An unexpected error occurred' }
      }));
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <PageWrapper
          headerContent={null}
          searchComponent={null}
          showAccountDropdown={true}
        >
          <ErrorContent
            statusCode={500}
            error={this.state.error}
          />
        </PageWrapper>
      );
    }

    return this.props.children;
  }
}

