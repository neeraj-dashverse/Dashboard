"use client";

import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "./cookies";

/** Supabase client for client components — session lives in cookies, so a sign-in persists across visits. */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars are missing");
  return createBrowserClient(url, key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

/**
 * Client for the magic-link callback only. Supabase's email links land with the session in the URL
 * hash (implicit flow), but the default browser client runs PKCE and ignores that hash. This client
 * reads the hash and then writes the resulting session into the same cookie the rest of the app uses.
 */
export function createCallbackSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars are missing");
  return createBrowserClient(url, key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    auth: { persistSession: true, autoRefreshToken: true, flowType: "implicit", detectSessionInUrl: true },
  });
}
