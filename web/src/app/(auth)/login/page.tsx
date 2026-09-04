"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "pin";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auth = supabase.auth as any;
    const { error: otpError } = await auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    setStep("pin");
  }

  async function handleVerifyPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auth = supabase.auth as any;
    const { error: verifyError } = await auth.verifyOtp({
      email,
      token: pin,
      type: "email",
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-brand">FHA</h1>
        <p className="text-sm text-slate-500 mb-6">
          Development & Property System
        </p>

        {step === "email" ? (
          <form onSubmit={handleSendPin} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@fha.gov.ng"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-accent disabled:opacity-50"
            >
              {loading ? "Sending PIN..." : "Send PIN"}
            </button>

            <p className="text-xs text-slate-500 text-center">
              We&apos;ll send a 6-digit code to your email
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <label htmlFor="pin" className="text-sm font-medium">
                Enter 6-digit PIN
              </label>
              <input
                id="pin"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-center tracking-[0.5em] font-mono"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-1">
                PIN sent to <span className="font-medium">{email}</span>
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || pin.length !== 6}
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-accent disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setPin("");
                setError(null);
              }}
              className="w-full text-xs text-slate-500 hover:text-slate-700"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
