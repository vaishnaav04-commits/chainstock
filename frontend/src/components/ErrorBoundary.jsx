
import React from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, info) {
    console.error("ChainStock rendering error:", error, info);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#080f1d] p-5 text-white">
          <div className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-[#132035] p-8 shadow-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <AlertTriangle size={27} />
            </div>

            <h1 className="mt-5 text-2xl font-extrabold">
              ChainStock encountered an error
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              The application couldn't render this screen.
              Your blockchain data has not been modified
              by this error screen.
            </p>

            {import.meta.env.DEV && (
              <pre className="mt-5 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 text-xs text-rose-300">
                {this.state.error?.message}
              </pre>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="btn-primary"
              >
                <RotateCcw size={17} />
                Try Again
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.assign("/");
                }}
                className="btn-secondary"
              >
                <Home size={17} />
                Go to Overview
              </button>
            </div>

            <p className="mt-5 text-xs text-slate-400">
              If the error continues, open the browser
              Console (F12) and inspect the first red error.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
