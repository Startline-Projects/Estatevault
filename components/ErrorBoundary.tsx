'use client'

import React from 'react'
import Link from 'next/link'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center px-4"
          style={{ backgroundColor: '#1C3557' }}
        >
          <div className="max-w-md w-full text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'rgba(201, 168, 76, 0.15)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: '#C9A84C' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-3">
              Something went wrong
            </h1>
            <p className="text-gray-300 mb-8 text-sm leading-relaxed">
              We encountered an unexpected error. Your information is safe — please
              try again or return to the home page.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 rounded-lg font-semibold text-sm transition-colors"
                style={{ backgroundColor: '#C9A84C', color: '#1C3557' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#b8953f'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#C9A84C'
                }}
              >
                Try Again
              </button>
              <Link
                href="/"
                className="px-6 py-3 rounded-lg font-semibold text-sm border border-gray-400 text-gray-300 hover:text-white hover:border-white transition-colors text-center"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
