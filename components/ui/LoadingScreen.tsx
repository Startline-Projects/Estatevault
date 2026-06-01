interface LoadingScreenProps {
  /** Reassuring line shown under the spinner. */
  message?: string;
  /** Center in the full viewport (e.g. pre-layout auth screens) instead of inline in a content area. */
  fullScreen?: boolean;
}

/**
 * Shared loading state for the app shells (dashboard, partner, sales, attorney, auth).
 * On-brand gold spinner with a soft halo + bouncing dots. Accessible via role="status".
 */
export default function LoadingScreen({ message = "Loading…", fullScreen = false }: LoadingScreenProps) {
  return (
    <div
      className={fullScreen ? "flex min-h-screen items-center justify-center bg-white" : "flex min-h-[calc(100vh-4rem)] items-center justify-center"}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{message}</span>
      <div className="flex flex-col items-center gap-5">
        {/* Spinner with a soft gold halo */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full bg-gold/15 blur-xl animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-gold/15" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold border-r-gold animate-spin" />
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <p className="text-sm font-medium text-charcoal/60">{message}</p>
          {/* Bouncing dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1s" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
