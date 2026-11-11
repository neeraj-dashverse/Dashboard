"use client";

import { useEffect, useState } from "react";
import { createCallbackSupabase } from "@/lib/supabase/browser";

/**
 * Magic-link landing page. Supabase's default email link redirects here with the session in the
 * URL hash (#access_token=...), which only the browser can read — a server route never sees it,
 * which is why sign-in previously bounced straight back to /login. The browser client parses the
 * hash, stores the session, and then we continue into the app.
 */
export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const supabase = createCallbackSupabase();
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") ?? "/";

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashError = hashParams.get("error_description");
    if (hashError) {
      window.location.replace(`/login?error=${encodeURIComponent(hashError)}`);
      return;
    }

    // Email links deliver the session in the hash. Read it directly rather than relying on the
    // client's URL detection, which the PKCE-default client silently skips.
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        if (error) {
          window.location.replace(`/login?error=${encodeURIComponent(error.message)}`);
          return;
        }
        window.location.replace(next.startsWith("/") ? next : "/");
      });
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        window.location.replace(next.startsWith("/") ? next : "/");
      }
    });

    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) window.location.replace(`/login?error=${encodeURIComponent(error.message)}`);
      });
    }

    const timer = window.setTimeout(() => {
      setMessage("This sign-in link didn't complete. Request a new one.");
    }, 8000);

    return () => {
      subscription.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-[#101218] px-4">
      <p className="text-[13px] text-slate-400">{message}</p>
    </div>
  );
}
