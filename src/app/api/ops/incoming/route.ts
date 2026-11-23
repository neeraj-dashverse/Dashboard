import { NextResponse } from "next/server";
import { loadNewMasterPromos } from "@/lib/ops/master-incoming";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { knownIds?: unknown } | null;
  const knownIds = Array.isArray(body?.knownIds)
    ? body.knownIds.filter((id): id is string => typeof id === "string")
    : [];
  const data = await loadNewMasterPromos(knownIds);
  return NextResponse.json(data);
}
