import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ padding: "2rem" }}>
        <h1>Something went wrong</h1>
        <pre style={{ whiteSpace: "pre-wrap", color: "var(--hp)" }}>{this.state.error.message}</pre>
        <a href="/">Back to start</a>
      </div>
    );
  }
}
