"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for client components — session lives in cookies, so a sign-in persists across visits. */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars are missing");
  return createBrowserClient(url, key);
}
