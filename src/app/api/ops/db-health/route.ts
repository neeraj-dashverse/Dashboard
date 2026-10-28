import { NextResponse } from "next/server";
import { probeOpsTables } from "@/lib/ops/persistence";
import { hasSupabase } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabase()) {
    return NextResponse.json(
      { ok: false, detail: "Supabase env vars missing" },
      { status: 503 }
    );
  }
  const result = await probeOpsTables();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
