export default function SalesLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-10 w-10 rounded-full border-4 border-gold/30 border-t-gold animate-spin" />
      <p className="text-sm text-charcoal/50">Loading sales portal...</p>
    </div>
  );
}
