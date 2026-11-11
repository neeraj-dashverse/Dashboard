"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get("error");
    if (callbackError) setError(callbackError);
  }, []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setStatus("sending");
    setError("");
    try {
      const supabase = createBrowserSupabase();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (sendError) throw sendError;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not send the link.");
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#101218] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#161a26] p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Dashverse</p>
        <h1 className="mt-1 text-xl font-extrabold text-white">PocketFM Ops</h1>
        <p className="mt-2 text-[12px] leading-5 text-slate-400">
          Enter your email. We&apos;ll send a sign-in link — no password, and you stay signed in after that.
        </p>

        {status === "sent" ? (
          <p className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-3 text-[13px] text-emerald-200">
            Check {email} for a sign-in link.
          </p>
        ) : (
          <form onSubmit={sendLink} className="mt-5 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@dashverse.ai"
              className="w-full rounded-lg border border-white/[0.12] bg-[#222738] px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-slate-500 focus:border-[#4361ee]"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-[#4361ee] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#5470f0] disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && <p className="text-[12px] text-rose-300">{error}</p>}
          </form>
        )}
        <p className="mt-5 text-[11px] text-slate-600">
          Access is by invite only. If your email isn&apos;t on the list yet, ask Neeraj to add it.
        </p>
      </div>
    </div>
  );
}
