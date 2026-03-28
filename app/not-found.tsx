import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#1C3557' }}
    >
      <div className="max-w-md w-full text-center">
        <p
          className="text-7xl font-bold mb-2"
          style={{ color: '#C9A84C' }}
        >
          404
        </p>

        <h1 className="text-2xl font-bold text-white mb-3">
          Page Not Found
        </h1>
        <p className="text-gray-300 mb-8 text-sm leading-relaxed">
          The page you are looking for does not exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <Link
          href="/"
          className="inline-block px-8 py-3 rounded-lg font-semibold text-sm transition-colors"
          style={{ backgroundColor: '#C9A84C', color: '#1C3557' }}
        >
          Return to Home
        </Link>
      </div>
    </div>
  )
}
