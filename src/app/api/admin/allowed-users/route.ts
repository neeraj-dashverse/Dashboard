import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { addAllowedUser, getRole, listAllowedUsers, removeAllowedUser, type Role } from "@/lib/auth/allowed-users";

async function requireAdmin(): Promise<{ email: string } | null> {
  const supabase = createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const role = await getRole(user.email);
  if (role !== "admin" && role !== "unconfigured") return null;
  return { email: user.email };
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = (await request.json()) as { email?: string; role?: Role };
  if (!body.email || !["admin", "viewer"].includes(body.role ?? "")) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  try {
    await addAllowedUser(body.email, body.role as Role, admin.email);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
  return NextResponse.json(await listAllowedUsers());
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = (await request.json()) as { email?: string };
  if (!body.email) return NextResponse.json({ error: "email is required" }, { status: 400 });
  if (body.email.toLowerCase() === admin.email.toLowerCase()) {
    return NextResponse.json({ error: "You can't remove your own access." }, { status: 400 });
  }

  try {
    await removeAllowedUser(body.email);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
  return NextResponse.json(await listAllowedUsers());
}
