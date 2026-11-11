import { Component } from 'react';

// Catches uncaught render errors below it so one broken component can't blank the whole app (wraps the app in App.jsx).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught error in app tree:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page narrow">
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Try refreshing the page.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}