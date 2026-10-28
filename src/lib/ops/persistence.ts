/**
 * Persist dashboard edits to Supabase so a refresh never loses them.
 * Sheet write-back (Gap 2) drains ops_write_queue later.
 */
import {
  hasSupabase,
  supabaseAdmin,
  type OpsWriteQueueRow,
} from "@/lib/db/supabase";
import type { OpsAction, PendingWrite } from "./types";

function targetMeta(target: string): { spreadsheet_id: string | null; tab_name: string | null } {
  if (/Master Tracker/i.test(target)) {
    return {
      spreadsheet_id: "1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs",
      tab_name: "Master Tracker",
    };
  }
  if (/Production Tracker/i.test(target)) {
    return {
      spreadsheet_id: "1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs",
      tab_name: "Production Tracker",
    };
  }
  if (/Pre Production/i.test(target)) {
    return {
      spreadsheet_id: "1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs",
      tab_name: "Pre Production Tracker",
    };
  }
  if (/Master Sheet/i.test(target)) {
    return {
      spreadsheet_id: "1-2MmgaVf4-lpJ4vu-p_9TB1J8ig4vn4yvz2K2Mft3vA",
      tab_name: "Master Sheet",
    };
  }
  return { spreadsheet_id: null, tab_name: null };
}

export async function enqueueWrite(
  action: OpsAction,
  target: string
): Promise<PendingWrite | null> {
  if (!hasSupabase()) return null;
  try {
    const meta = targetMeta(target);
    const { data, error } = await supabaseAdmin()
      .from("ops_write_queue")
      .insert({
        action,
        target,
        spreadsheet_id: meta.spreadsheet_id,
        tab_name: meta.tab_name,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) {
      console.error("[ops] enqueueWrite failed:", error.message);
      return null;
    }
    const row = data as OpsWriteQueueRow;
    return {
      id: row.id,
      at: row.created_at,
      action: row.action as OpsAction,
      target: row.target,
      status: "pending",
    };
  } catch (err) {
    console.error("[ops] enqueueWrite exception:", err);
    return null;
  }
}

/** Unsynced edits, oldest first — replay onto a fresh Sheets snapshot. */
export async function loadPendingWrites(): Promise<PendingWrite[]> {
  if (!hasSupabase()) return [];
  try {
    const { data, error } = await supabaseAdmin()
      .from("ops_write_queue")
      .select("*")
      .in("status", ["pending", "syncing", "error"])
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[ops] loadPendingWrites failed:", error.message);
      return [];
    }
    return ((data as OpsWriteQueueRow[]) || []).map((row) => ({
      id: row.id,
      at: row.created_at,
      action: row.action as OpsAction,
      target: row.target,
      status: row.status === "synced" ? "synced" : row.status === "error" ? "error" : "pending",
    }));
  } catch (err) {
    console.error("[ops] loadPendingWrites exception:", err);
    return [];
  }
}

export async function loadDismissedNudgeIds(): Promise<string[]> {
  if (!hasSupabase()) return [];
  try {
    const { data, error } = await supabaseAdmin()
      .from("ops_dismissed_nudges")
      .select("nudge_id");
    if (error) {
      console.error("[ops] loadDismissedNudgeIds failed:", error.message);
      return [];
    }
    return (data || []).map((r: { nudge_id: string }) => r.nudge_id);
  } catch (err) {
    console.error("[ops] loadDismissedNudgeIds exception:", err);
    return [];
  }
}

export async function persistDismissNudge(nudgeId: string): Promise<void> {
  if (!hasSupabase()) return;
  try {
    const { error } = await supabaseAdmin()
      .from("ops_dismissed_nudges")
      .upsert({ nudge_id: nudgeId, dismissed_at: new Date().toISOString() });
    if (error) console.error("[ops] persistDismissNudge failed:", error.message);
  } catch (err) {
    console.error("[ops] persistDismissNudge exception:", err);
  }
}

/** Mark pending queue rows synced (called after successful Sheets flush). */
export async function markWritesSynced(ids: string[]): Promise<void> {
  if (!hasSupabase() || ids.length === 0) return;
  const { error } = await supabaseAdmin()
    .from("ops_write_queue")
    .update({
      status: "synced",
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (error) console.error("[ops] markWritesSynced failed:", error.message);
}

export async function probeOpsTables(): Promise<{ ok: boolean; detail: string }> {
  if (!hasSupabase()) return { ok: false, detail: "Supabase env missing" };
  const { error } = await supabaseAdmin().from("ops_write_queue").select("id").limit(1);
  if (error) {
    return {
      ok: false,
      detail: error.message.includes("Could not find the table")
        ? "Tables missing — run supabase/migrations/20261028_ops_persistence.sql in SQL Editor"
        : error.message,
    };
  }
  return { ok: true, detail: "ops_write_queue reachable" };
}
