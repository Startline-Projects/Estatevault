export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-4 border-gold/30 border-t-gold animate-spin" />
        <p className="text-sm text-charcoal/50">Loading...</p>
      </div>
    </div>
  );
}
