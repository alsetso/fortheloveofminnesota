'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import PageLayout from '../layout/PageLayout';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <PageLayout showHeader={true} showFooter={true}>
          <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
              <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
              <p className="text-gray-600 mb-6">
                We&apos;re sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
              </p>
              {this.state.error && process.env.NODE_ENV === 'development' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                  <p className="text-xs font-mono text-red-800 break-words">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}
              <button
                onClick={this.handleReset}
                className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
              >
                Go to Homepage
              </button>
            </div>
          </div>
        </PageLayout>
      );
    }

    return this.props.children;
  }
}

