import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[doodle-guess] render error', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <main className="screen error-screen" role="alert">
        <div className="error-card">
          <span className="error-card__tape" aria-hidden="true" />
          <p className="eyebrow">纸张皱了</p>
          <h1>这一页出了点小问题</h1>
          <p>画作还在本地，刷新一下就能继续。</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      </main>
    )
  }
}
