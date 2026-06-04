interface LoadingScreenProps {
  /** Reassuring line shown under the spinner. */
  message?: string;
  /** Center in the full viewport (e.g. pre-layout auth screens) instead of inline in a content area. */
  fullScreen?: boolean;
  /** Emblem rendered inside the spinner. Defaults to the EstateVault lock. */
  icon?: string;
}

/**
 * Shared full-screen loading state for the client portal (and other app shells).
 * On-brand: a lock emblem framed by dual counter-rotating gold rings over a soft
 * pulsing halo, with a message and shimmering dots. Accessible via role="status".
 *
 * This is THE default full-screen loader — use it instead of bespoke spinners.
 */
export default function LoadingScreen({ message = "Loading…", fullScreen = false, icon = "🔐" }: LoadingScreenProps) {
  return (
    <div
      className={fullScreen ? "flex min-h-screen items-center justify-center bg-white" : "flex min-h-[calc(100vh-4rem)] items-center justify-center"}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{message}</span>
      <div className="flex flex-col items-center gap-7">
        {/* Emblem framed by dual counter-rotating rings over a pulsing halo */}
        <div className="relative h-20 w-20">
          {/* Soft glow */}
          <div className="absolute -inset-2 rounded-full bg-gold/20 blur-2xl animate-pulse" />
          {/* Faint full track */}
          <div className="absolute inset-0 rounded-full border-2 border-gold/10" />
          {/* Outer ring — clockwise */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold border-r-gold animate-spin" style={{ animationDuration: "1.1s" }} />
          {/* Inner ring — counter-clockwise, slower */}
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-navy/40 border-l-navy/40 animate-spin" style={{ animationDuration: "1.8s", animationDirection: "reverse" }} />
          {/* Center emblem */}
          <div className="absolute inset-[18px] rounded-full bg-gold/10 flex items-center justify-center">
            <span className="text-2xl">{icon}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-charcoal/70">{message}</p>
          {/* Shimmering dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-gold/70 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1s" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
