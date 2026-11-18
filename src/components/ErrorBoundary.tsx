import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Unexpected error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-[#09090B] text-zinc-900 dark:text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white font-display">Something went wrong</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 break-words">
              {this.state.message.startsWith('{')
                ? 'A database permission or configuration check prevented this action. Please sign in with a verified account or refresh the page.'
                : this.state.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Reload BHARATPLAY
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
