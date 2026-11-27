import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/allowed-users";
import { createServerSupabase } from "@/lib/supabase/server";
import { opsAdapter } from "@/lib/ops/adapter";
import {
  pastePocketFmScript,
  writeTrackerHandoff,
  writeTrackerIntake,
  writeTrackerPromoName,
} from "@/lib/ops/workflow-write";

async function requireAdmin(): Promise<{ error: string } | { email: string | null }> {
  const supabase = createServerSupabase();
  if (!supabase) return { email: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Sign in required." };
  const role = await getRole(user.email);
  if (role === "unconfigured") return { email: user.email };
  if (role == null) return { error: "You are not on the access list yet." };
  if (role !== "admin") return { error: "View-only access — ask Neeraj for edit access." };
  return { email: user.email };
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        showName?: string;
        promoName?: string;
        cps?: string;
        script?: string;
        agencyScript?: string;
        demarcatedScript?: string;
        makeCopy?: boolean;
      }
    | null;

  let copyUrl: string | null = null;
  let copyError: string | null = null;

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
    } else if (body?.action === "handoff") {
      await writeTrackerHandoff({
        showName: String(body.showName ?? ""),
        promoName: String(body.promoName ?? ""),
        cps: String(body.cps ?? ""),
        script: String(body.script ?? ""),
        agencyScript: String(body.agencyScript ?? ""),
        demarcatedScript: String(body.demarcatedScript ?? ""),
      });
    } else if (body?.action === "paste-script") {
      const result = await pastePocketFmScript({
        showName: String(body.showName ?? ""),
        promoName: String(body.promoName ?? ""),
        script: String(body.script ?? ""),
        makeCopy: body.makeCopy !== false,
        shareWith: access.email,
      });
      copyUrl = result.copyUrl;
      copyError = result.copyError;
    } else {
      return NextResponse.json({ error: "Unknown workflow action." }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sheet write failed.";
    console.error("[ops] workflow write failed:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const snap = opsAdapter.reset ? await opsAdapter.reset() : await opsAdapter.load();
  return NextResponse.json({ ok: true, snap, copyUrl, copyError });
}
