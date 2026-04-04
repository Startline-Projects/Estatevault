import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-navy-900 py-16 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          {/* Logo + tagline */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.svg"
                alt="EstateVault"
                width={36}
                height={36}
              />
              <span className="text-lg font-bold text-white">EstateVault</span>
            </Link>
            <p className="text-sm text-white/50 max-w-xs">
              Protect Everything That Matters. Attorney-reviewed estate planning for Michigan families.
            </p>
          </div>

          {/* Link groups */}
          <div className="flex gap-16">
            <div>
              <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">Company</h4>
              <nav className="flex flex-col gap-3 text-sm">
                <Link href="/privacy" className="text-white/50 hover:text-white transition-colors duration-200">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-white/50 hover:text-white transition-colors duration-200">
                  Terms of Service
                </Link>
                <Link href="/contact" className="text-white/50 hover:text-white transition-colors duration-200">
                  Contact
                </Link>
              </nav>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">Product</h4>
              <nav className="flex flex-col gap-3 text-sm">
                <Link href="/quiz" className="text-white/50 hover:text-white transition-colors duration-200">
                  Free Quiz
                </Link>
                <Link href="/will" className="text-white/50 hover:text-white transition-colors duration-200">
                  Will Package
                </Link>
                <Link href="/trust" className="text-white/50 hover:text-white transition-colors duration-200">
                  Trust Package
                </Link>
                <Link href="/professionals" className="text-white/50 hover:text-white transition-colors duration-200">
                  For Professionals
                </Link>
              </nav>
            </div>
          </div>
        </div>

        <div className="my-10 h-px bg-white/10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/50">
            &copy; 2026 EstateVault Technologies LLC. All rights reserved.
          </p>
        </div>

        <p className="mt-6 text-xs text-white/40 leading-relaxed max-w-4xl">
          This platform provides document preparation services only. It does not
          provide legal advice. No attorney-client relationship is created by
          your use of this platform. Documents should be reviewed by a licensed
          attorney if you have questions about your specific legal situation.
        </p>
      </div>
    </footer>
  );
}
