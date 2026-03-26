interface CheckEmailCTAProps {
  email?: string;
}

export default function CheckEmailCTA({ email }: CheckEmailCTAProps) {
  return (
    <div className="rounded-2xl bg-navy/90 border border-white/10 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/20">
        <span className="text-3xl">✉</span>
      </div>
      <h2 className="mt-5 text-lg font-bold text-white">Check your email</h2>
      <p className="mt-3 text-sm text-blue-100/70 leading-relaxed max-w-sm mx-auto">
        We sent your documents and account access link to{" "}
        {email ? (
          <span className="font-medium text-white">{email}</span>
        ) : (
          "your email"
        )}
        . Click the link in the email to set your password and access your
        account.
      </p>
      <p className="mt-6 text-xs text-blue-100/40">
        Didn&apos;t get it? Check your spam folder or contact
        support@estatevault.com
      </p>
    </div>
  );
}
