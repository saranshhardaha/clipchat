'use client';
import { Component, type ReactNode } from 'react';

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div>
            <p className="text-destructive font-medium">Something went wrong</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-2 text-sm underline text-muted-foreground"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
