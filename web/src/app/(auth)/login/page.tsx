"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AuthLike } from "@/lib/supabase/types";

type Step = "email" | "pin";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = (() => {
  const r = searchParams.get("redirect");
  if (!r) return "/dashboard";
  // Only allow relative paths starting with /, no // or protocol
  if (r.startsWith("/") && !r.startsWith("//") && !r.includes("://")) return r;
  return "/dashboard";
})();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  async function handleSendPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    const auth = supabase.auth as unknown as AuthLike;
    const { error: otpError } = await auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    setLoading(false);
    if (otpError) {
      if (otpError.message.includes("not found") || otpError.message.includes("invalid")) {
        setError("No account found for this email. Contact your administrator.");
      } else {
        setError(otpError.message);
      }
      return;
    }
    setStep("pin");
    startResendCooldown();
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleResendPin() {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    const auth = supabase.auth as unknown as AuthLike;
    const { error: otpError } = await auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    startResendCooldown();
  }

  async function handleVerifyPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(pin)) {
      setError("PIN must be exactly 6 digits");
      return;
    }

    setLoading(true);
    const auth = supabase.auth as unknown as AuthLike;
    const { error: verifyError } = await auth.verifyOtp({
      email,
      token: pin,
      type: "email",
    });

    setLoading(false);
    if (verifyError) {
      setError("Invalid or expired PIN. Please try again.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — Government branding panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative z-10 flex flex-col justify-between h-full px-10 py-10">
          {/* Top: Coat of arms / crest */}
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-wide">FEDERAL HOUSING AUTHORITY</p>
                <p className="text-[11px] text-emerald-400/70 mt-0.5 tracking-wider uppercase">Government of Nigeria</p>
              </div>
            </div>

            {/* Feature cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">System Capabilities</h3>
              {[
                { icon: "M9 6.75V15m6-6v8.25m-10.5 0h10.5c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.875c-.621 0-1.125.504-1.125 1.125v9.75", title: "GIS Estate Mapping", desc: "Interactive map with plot selection and area drawing" },
                { icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z", title: "Approval Verification", desc: "Verify property approvals and access documents" },
                { icon: "M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z", title: "Field Inspections", desc: "GPS capture, photos, and compliance tracking" },
                { icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", title: "Document Management", desc: "Secure access to approval and allocation documents" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4.5 h-4.5 text-emerald-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">{item.title}</p>
                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: version + copyright */}
          <div className="text-[11px] text-white/25 space-y-1">
            <p>Version 0.1 — MVP</p>
            <p>Federal Housing Authority &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="px-6 lg:px-10 py-5 flex items-center justify-between border-b border-border/50">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-sm shadow-brand/15">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-foreground leading-none">FHA</p>
              <p className="text-[10px] text-muted-foreground">Property Mapping</p>
            </div>
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Online
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {step === "email" ? "Sign in to your account" : "Verify your identity"}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step === "email"
                  ? "Enter your registered email to receive a one-time verification code. No password required."
                  : `A 6-digit verification code has been sent to`}
              </p>
              {step === "pin" && (
                <p className="text-sm font-medium text-foreground">{email}</p>
              )}
            </div>

            {step === "email" ? (
              <form onSubmit={handleSendPin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@fha.gov.ng"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-xl bg-danger-light/50 border border-danger/15 px-4 py-3">
                    <svg className="w-4 h-4 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <div>
                      <p className="text-sm text-danger font-medium">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand/20 hover:bg-brand-light hover:shadow-lg hover:shadow-brand/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-200"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending verification code...
                    </span>
                  ) : "Send verification code"}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  Contact your administrator if you do not have an account.
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerifyPin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="pin" className="block text-sm font-medium text-foreground">
                    6-digit verification code
                  </label>
                  <input
                    id="pin"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setPin(val);
                      if (val.length === 6) {
                        setTimeout(() => {
                          const form = e.target.closest("form");
                          if (form) form.requestSubmit();
                        }, 100);
                      }
                    }}
                    placeholder="Enter code"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-center text-2xl tracking-[0.5em] font-mono placeholder:text-muted-foreground/30 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Check your inbox for the verification code.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-xl bg-danger-light/50 border border-danger/15 px-4 py-3">
                    <svg className="w-4 h-4 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <div>
                      <p className="text-sm text-danger font-medium">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || pin.length !== 6}
                  className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand/20 hover:bg-brand-light hover:shadow-lg hover:shadow-brand/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-200"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying...
                    </span>
                  ) : "Sign in"}
                </button>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setPin(""); setError(null); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    onClick={handleResendPin}
                    disabled={resendCooldown > 0 || loading}
                    className={`font-medium transition-colors ${resendCooldown > 0 ? "text-muted-foreground/50 cursor-not-allowed" : "text-brand hover:text-brand-light"}`}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 lg:px-10 py-4 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground/60">
          <p>Federal Housing Authority &copy; {new Date().getFullYear()}</p>
          <p>Secure Access</p>
        </div>
      </div>
    </div>
  );
}
