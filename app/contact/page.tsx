"use client";

import { useState, FormEvent } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { contact } from "@/lib/api-client/misc";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const fieldErrors = {
    name: touched.name && !name.trim() ? "Name is required." : "",
    email: touched.email && !email.trim() ? "Email is required." : touched.email && !emailValid ? "Enter a valid email address." : "",
    message: touched.message && !message.trim() ? "Message is required." : touched.message && message.trim().length < 10 ? "Please write at least 10 characters." : "",
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: apiError } = await contact({ name, email, message });
      if (apiError) throw new Error(apiError);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-navy mb-4">
            We&apos;re Here to Help
          </h1>
          <p className="text-charcoal/70 mb-4 text-lg">
            Have a question about your estate plan or your account? Reach out anytime.
          </p>
          <p className="text-charcoal mb-12">
            Email us directly at{" "}
            <a
              href="mailto:info@estatevault.us"
              className="text-gold hover:underline font-medium"
            >
              info@estatevault.us
            </a>
          </p>

          {submitted ? (
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-10 text-center">
              <div className="text-3xl mb-4">&#10003;</div>
              <h2 className="text-2xl font-semibold text-navy mb-2">
                Your message has been sent.
              </h2>
              <p className="text-charcoal/70">
                Our team will respond within one business day. Thank you for reaching out.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-6 max-w-2xl"
            >
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-charcoal mb-1.5"
                >
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  className={`w-full rounded-lg border px-4 py-3 text-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gold/30 ${fieldErrors.name ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-gold"}`}
                  placeholder="Your name"
                />
                {fieldErrors.name && <p id="name-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-charcoal mb-1.5"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  className={`w-full rounded-lg border px-4 py-3 text-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gold/30 ${fieldErrors.email ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-gold"}`}
                  placeholder="you@example.com"
                />
                {fieldErrors.email && <p id="email-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-charcoal mb-1.5"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, message: true }))}
                  aria-invalid={!!fieldErrors.message}
                  aria-describedby={fieldErrors.message ? "message-error" : undefined}
                  className={`w-full rounded-lg border px-4 py-3 text-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gold/30 resize-vertical ${fieldErrors.message ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-gold"}`}
                  placeholder="How can we help you?"
                />
                {fieldErrors.message && <p id="message-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.message}</p>}
              </div>

              {error && (
                <p id="contact-error" role="alert" className="text-sm text-red-600">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-navy px-8 py-3 text-white font-medium hover:bg-navy-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
