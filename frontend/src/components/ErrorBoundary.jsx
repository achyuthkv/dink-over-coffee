import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-alt flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-primary text-2xl font-extrabold">Something went wrong</h1>
          <p className="text-muted text-sm mt-2 mb-5">An unexpected error occurred.</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center rounded-full bg-interactive text-inverse px-5 py-2.5 text-sm font-semibold active:scale-[.98] transition"
          >
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
