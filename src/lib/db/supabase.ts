/**
 * Server-only Supabase clients (previous Dashverse project).
 * Never import from a client component — service role bypasses RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type OpsWriteQueueRow = {
  id: string;
  created_at: string;
  updated_at: string;
  action: unknown;
  target: string;
  spreadsheet_id: string | null;
  tab_name: string | null;
  status: "pending" | "syncing" | "synced" | "error" | "cancelled";
  error: string | null;
  attempts: number;
  synced_at: string | null;
};

export type OpsDismissedNudgeRow = {
  nudge_id: string;
  dismissed_at: string;
};

export type OpsKnownMasterPromoRow = {
  join_key: string;
  show_name: string;
  promo_name: string;
  first_seen_at: string;
  last_seen_at: string;
  notified_at: string | null;
  in_tracker: boolean;
};

let serviceClient: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Service-role client — server routes / adapters only. */
export function supabaseAdmin(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}
