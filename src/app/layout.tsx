import { Sidebar } from "@/components/Sidebar";
import { OpsProvider } from "@/components/ops/OpsProvider";
import { opsAdapter } from "@/lib/ops/adapter";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PocketFM Ops · Dashverse",
  description: "PocketFM production operations tool",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const snap = await opsAdapter.load();
  return (
    <html lang="en">
      <body>
        <OpsProvider initial={snap}>
          <div className="min-h-screen bg-[#101218]">
            <div className="mx-auto flex min-h-screen max-w-[1800px] flex-row">
              <Sidebar />
              <div className="min-w-0 flex-1">
                <header className="border-b border-white/[0.1] bg-[#161a26]/95 px-5 py-3 backdrop-blur lg:px-7">
                  <div className="flex items-center justify-between gap-4">
                    <div className="lg:hidden">
                      <p className="text-sm font-semibold text-white">PocketFM Ops</p>
                    </div>
                    <div className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#4361ee] to-[#d6293d] text-xs font-bold text-white">
                      N
                    </div>
                  </div>
                </header>
                <main className="px-5 py-5 lg:px-7 lg:py-6">{children}</main>
              </div>
            </div>
          </div>
        </OpsProvider>
      </body>
    </html>
  );
}
