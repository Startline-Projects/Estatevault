"use client";

import { useState, FormEvent } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    // Simulate submission delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSubmitted(true);
    setLoading(false);
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
              href="mailto:support@estatevault.us"
              className="text-gold hover:underline font-medium"
            >
              support@estatevault.us
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
                  placeholder="Your name"
                />
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
                  placeholder="you@example.com"
                />
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
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 resize-vertical"
                  placeholder="How can we help you?"
                />
              </div>

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
