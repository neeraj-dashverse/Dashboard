import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/allowed-users";
import { createServerSupabase } from "@/lib/supabase/server";
import { opsAdapter } from "@/lib/ops/adapter";
import { writeTrackerIntake, writeTrackerPromoName } from "@/lib/ops/workflow-write";

async function requireAdmin(): Promise<string | null> {
  const supabase = createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return "Sign in required.";
  const role = await getRole(user.email);
  if (role === "unconfigured") return null;
  if (role == null) return "You are not on the access list yet.";
  if (role !== "admin") return "View-only access — ask Neeraj for edit access.";
  return null;
}

export async function POST(request: Request) {
  const deny = await requireAdmin();
  if (deny) return NextResponse.json({ error: deny }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        showName?: string;
        promoName?: string;
        cps?: string;
        script?: string;
        agencyScript?: string;
        demarcatedScript?: string;
      }
    | null;

  try {
    if (body?.action === "name") {
      await writeTrackerPromoName(String(body.showName ?? ""), String(body.promoName ?? ""));
    } else if (body?.action === "intake") {
      await writeTrackerIntake({
        showName: String(body.showName ?? ""),
        promoName: String(body.promoName ?? ""),
        cps: String(body.cps ?? ""),
        script: String(body.script ?? ""),
        agencyScript: String(body.agencyScript ?? ""),
        demarcatedScript: String(body.demarcatedScript ?? ""),
      });
    } else {
      return NextResponse.json({ error: "Unknown workflow action." }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sheet write failed.";
    console.error("[ops] workflow write failed:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const snap = opsAdapter.reset ? await opsAdapter.reset() : await opsAdapter.load();
  return NextResponse.json({ ok: true, snap });
}
