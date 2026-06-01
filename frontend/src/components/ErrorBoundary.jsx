import { Component } from "react";
import { AlertCircle } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-ink-950 p-6 text-text">
          <div className="max-w-md rounded-2xl border border-danger/25 bg-danger/10 p-5">
            <AlertCircle className="mb-3 h-6 w-6 text-danger" />
            <h1 className="font-display text-lg font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              VoxMind hit a UI error. Refresh the app and try again.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
