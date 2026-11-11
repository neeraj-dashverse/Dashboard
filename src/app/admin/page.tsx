import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRole, listAllowedUsers } from "@/lib/auth/allowed-users";
import { AdminPanel } from "./AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const roleLookup = user?.email ? await getRole(user.email) : "unconfigured";
  const role = roleLookup === "unconfigured" ? "admin" : roleLookup;

  if (role !== "admin") redirect("/");

  const users = await listAllowedUsers();
  return <AdminPanel users={users} currentEmail={user?.email ?? ""} />;
}
