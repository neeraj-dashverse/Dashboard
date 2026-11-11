import { NextResponse } from "next/server";
import { opsAdapter } from "@/lib/ops/adapter";
import type { OpsAction } from "@/lib/ops/types";
import { getRole } from "@/lib/auth/allowed-users";
import { createServerSupabase } from "@/lib/supabase/server";

/** Defense in depth: the client UI already blocks viewers, but writes are re-checked here too. */
async function requireAdminForWrites(): Promise<string | null> {
  const supabase = createServerSupabase();
  if (!supabase) return null; // Supabase not configured — don't block local/dev use.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return "Sign in required.";
  const role = await getRole(user.email);
  if (role === "unconfigured") return null; // allowed_users table not set up yet — don't block writes.
  if (role == null) return "You are not on the access list yet.";
  if (role !== "admin") return "View-only access — ask Neeraj for edit access.";
  return null;
}

export async function GET() {
  const snapshot = await opsAdapter.load();
  return NextResponse.json(snapshot);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: OpsAction;
    flush?: boolean;
    reset?: boolean;
  };

  if (body.reset && opsAdapter.reset) {
    return NextResponse.json(await opsAdapter.reset());
  }

  if (body.flush || body.action) {
    const denyReason = await requireAdminForWrites();
    if (denyReason) return NextResponse.json({ error: denyReason }, { status: 403 });
  }

  if (body.flush) {
    return NextResponse.json(await opsAdapter.flushWrites());
  }
  if (!body.action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  const snapshot = await opsAdapter.act(body.action);
  return NextResponse.json(snapshot);
}
