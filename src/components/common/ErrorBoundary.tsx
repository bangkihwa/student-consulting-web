import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ color: 'red', marginBottom: 16 }}>오류가 발생했습니다</h2>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, textAlign: 'left', whiteSpace: 'pre-wrap', maxWidth: 600, margin: '0 auto' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.href = '/admin'
            }}
            style={{ marginTop: 16, padding: '8px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            관리자 페이지로 돌아가기
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
