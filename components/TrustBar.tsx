const items = [
  { icon: "⚖", label: "Attorney-Reviewed" },
  { icon: "🔒", label: "256-bit Encrypted" },
  { icon: "📋", label: "State-Specific Documents" },
  { icon: "🏛", label: "Secure Family Vault" },
];

export default function TrustBar() {
  return (
    <section className="bg-gray-50 py-6 px-6">
      <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-center gap-8 md:gap-14">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-charcoal">
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
