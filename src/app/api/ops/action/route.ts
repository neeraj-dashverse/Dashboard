import { NextResponse } from "next/server";
import { opsAdapter } from "@/lib/ops/adapter";
import type { OpsAction } from "@/lib/ops/types";

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
  if (body.flush) {
    return NextResponse.json(await opsAdapter.flushWrites());
  }
  if (!body.action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  const snapshot = await opsAdapter.act(body.action);
  return NextResponse.json(snapshot);
}
