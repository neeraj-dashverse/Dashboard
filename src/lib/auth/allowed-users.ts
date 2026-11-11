/**
 * Who may open the dashboard, and whether they can edit (admin) or only view (viewer).
 * Backed by the `allowed_users` table — see supabase/migrations/20261111_ops_auth.sql.
 * All access goes through supabaseAdmin() (service role) so this does not depend on RLS policies.
 */
import { hasSupabase, supabaseAdmin } from "@/lib/db/supabase";

export type Role = "admin" | "viewer";
export type AllowedUser = { email: string; role: Role; added_at: string; added_by: string | null };

// Postgres "undefined_table" and PostgREST's "table not in schema cache" — both mean the
// supabase/migrations/20261111_ops_auth.sql migration hasn't been run yet.
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

/**
 * null = not on the allow-list.
 * "unconfigured" = the allowed_users table doesn't exist yet (migration not applied) —
 * callers should treat this as "let everyone in as admin for now" rather than locking everyone out.
 */
export async function getRole(email: string | null | undefined): Promise<Role | null | "unconfigured"> {
  if (!email || !hasSupabase()) return "unconfigured";
  const { data, error } = await supabaseAdmin()
    .from("allowed_users")
    .select("role")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code)) return "unconfigured";
    console.error("[auth] getRole failed:", error.message);
    return null;
  }
  return (data?.role as Role | undefined) ?? null;
}

export async function listAllowedUsers(): Promise<AllowedUser[]> {
  if (!hasSupabase()) return [];
  const { data, error } = await supabaseAdmin()
    .from("allowed_users")
    .select("email, role, added_at, added_by")
    .order("added_at", { ascending: true });
  if (error) {
    if (!MISSING_TABLE_CODES.has(error.code)) console.error("[auth] listAllowedUsers failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function addAllowedUser(email: string, role: Role, addedBy: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("allowed_users")
    .upsert({ email: email.toLowerCase().trim(), role, added_by: addedBy }, { onConflict: "email" });
  if (error) throw new Error(error.message);
}

export async function removeAllowedUser(email: string): Promise<void> {
  const { error } = await supabaseAdmin().from("allowed_users").delete().eq("email", email.toLowerCase().trim());
  if (error) throw new Error(error.message);
}
