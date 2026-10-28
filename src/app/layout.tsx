import { Sidebar } from "@/components/Sidebar";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PocketFM Ops · Dashverse",
  description: "PocketFM production operations tool",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[#0a0a0d]">
          <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col lg:flex-row">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <header className="border-b border-white/[0.08] bg-[#101014]/90 px-5 py-3 backdrop-blur lg:px-7">
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
      </body>
    </html>
  );
}
