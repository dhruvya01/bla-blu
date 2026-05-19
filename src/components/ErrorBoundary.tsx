import React from 'react';

export class GlobalErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Global Error Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-10 text-center z-[9999]">
          <div className="text-4xl mb-4">🐣</div>
          <h1 className="text-xl font-bold text-slate-800">Something went wrong</h1>
          <p className="text-xs text-slate-400 mt-2 mb-6">The app nest needs a quick reset.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary text-white px-6 py-2 rounded-xl text-xs font-bold"
          >
            Restart App
          </button>
          <pre className="mt-8 text-[10px] text-slate-800 overflow-auto max-w-full p-4 bg-slate-200 rounded text-left w-full">
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
