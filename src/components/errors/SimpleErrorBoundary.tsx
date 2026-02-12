'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SimpleErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SimpleErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-surface-muted">
          <div className="flex flex-col items-center gap-6 px-4">
            <Image
              src="/logo.png"
              alt="Love of Minnesota"
              width={120}
              height={120}
              className="w-30 h-30"
              priority
            />
            <div className="text-center space-y-2">
              <h1 className="text-xl font-semibold text-foreground">Resource not found</h1>
              <p className="text-sm text-foreground-muted max-w-md">
                The page you're looking for doesn't exist or may have been removed.
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-lake-blue text-white rounded-md text-sm font-medium hover:bg-lake-blue/90 transition-colors"
            >
              Go to Home
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
