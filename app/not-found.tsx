import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-navy">
      <div className="max-w-md w-full text-center">
        <p className="text-7xl font-bold mb-2 text-gold">
          404
        </p>

        <h1 className="text-2xl font-bold text-white mb-3">
          We couldn&apos;t find that page
        </h1>
        <p className="text-gray-300 mb-8 text-sm leading-relaxed">
          The page you&apos;re looking for may have been moved or no longer
          exists. Let&apos;s get you back on track.
        </p>

        <Link
          href="/"
          className="inline-block px-8 py-3 rounded-lg font-semibold text-sm transition-colors bg-gold text-navy hover:bg-gold-600"
        >
          Return to Home
        </Link>
      </div>
    </div>
  )
}
