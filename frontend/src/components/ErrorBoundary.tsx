import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-screen" role="alert">
          <h1>{t('error.title')}</h1>
          <p>{t('error.body')}</p>
          <pre>{this.state.error.message}</pre>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>{t('error.reload')}</button>
        </main>
      );
    }
    return this.props.children;
  }
}
