import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-navy/95 py-12 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Logo + tagline */}
          <div>
            <p className="text-lg font-bold text-white">EstateVault</p>
            <p className="mt-1 text-sm text-gray-400">
              Protect Everything That Matters
            </p>
          </div>

          {/* Links */}
          <nav className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
              Contact
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-gray-500">
            &copy; 2025 EstateVault Technologies LLC
          </p>
        </div>

        <hr className="my-8 border-white/10" />

        <p className="text-xs text-gray-500 leading-relaxed max-w-4xl">
          This platform provides document preparation services only. It does not
          provide legal advice. No attorney-client relationship is created by
          your use of this platform. Documents should be reviewed by a licensed
          attorney if you have questions about your specific legal situation.
        </p>
      </div>
    </footer>
  );
}
