// Error boundary to isolate component failures during hydration/render.
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true, error: _error.message };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    console.error('[EngineeringViz ErrorBoundary]', _error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="eng-demo eng-demo-error" role="alert" aria-live="polite">
          <p>Visualization component failed to load: {this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
