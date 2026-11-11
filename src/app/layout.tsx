import { headers } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { HeaderBar } from "@/components/HeaderBar";
import { OpsProvider } from "@/components/ops/OpsProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { opsAdapter } from "@/lib/ops/adapter";
import { getRole } from "@/lib/auth/allowed-users";
import { createServerSupabase } from "@/lib/supabase/server";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PocketFM Ops · Dashverse",
  description: "PocketFM production operations tool",
};

export const dynamic = "force-dynamic";

const NO_CHROME_PATHS = ["/login", "/auth/callback"];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = headers().get("x-pathname") ?? "";
  const skipChrome = NO_CHROME_PATHS.some((path) => pathname.startsWith(path));

  if (skipChrome) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  const supabase = createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const email = user?.email ?? null;
  const roleLookup = email ? await getRole(email) : "unconfigured";
  // "unconfigured" = the allowed_users table/migration hasn't been applied yet — don't lock everyone out.
  const role = roleLookup === "unconfigured" ? "admin" : roleLookup;

  if (email && !role) {
    return (
      <html lang="en">
        <body>
          <div className="flex h-screen items-center justify-center bg-[#101218] px-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#161a26] p-6 text-center">
              <h1 className="text-lg font-extrabold text-white">Access pending</h1>
              <p className="mt-2 text-[12px] leading-5 text-slate-400">
                Signed in as <span className="text-slate-200">{email}</span>, but this email isn&apos;t on the
                dashboard&apos;s access list yet. Ask Neeraj to add you.
              </p>
              <a
                href="/api/auth/signout"
                className="mt-5 inline-block rounded-lg border border-white/[0.12] px-4 py-2 text-[12px] font-semibold text-slate-300 hover:text-white"
              >
                Sign out
              </a>
            </div>
          </div>
        </body>
      </html>
    );
  }

  const snap = await opsAdapter.load();

  return (
    <html lang="en">
      <body>
        <AuthProvider email={email ?? ""} role={role ?? "admin"}>
          <OpsProvider initial={snap} canEdit={(role ?? "admin") === "admin"}>
            <div className="h-screen overflow-hidden bg-[#101218]">
              <div className="mx-auto flex h-full max-w-[1800px] flex-row">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                  <HeaderBar />
                  <main className="flex-1 overflow-y-auto px-5 py-5 lg:px-7 lg:py-6">{children}</main>
                </div>
              </div>
            </div>
          </OpsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
