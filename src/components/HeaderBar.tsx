"use client";

import { useState } from "react";
import Link from "next/link";
import { useOps } from "./ops/OpsProvider";
import { useAuth } from "./auth/AuthProvider";

/** Top-right chrome: refresh (re-pulls Google Sheets), account menu, avatar. */
export function HeaderBar() {
  const { busy, reset } = useOps();
  const { email, role, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-white/[0.1] bg-[#161a26]/95 px-5 py-3 backdrop-blur lg:px-7">
      <div className="flex items-center justify-between gap-4">
        <div className="lg:hidden">
          <p className="text-sm font-semibold text-white">PocketFM Ops</p>
        </div>
        <div className="relative ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => reset()}
            title="Re-pull latest rows from Google Sheets"
            className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white disabled:opacity-40"
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title={email || "Account"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#4361ee] to-[#d6293d] text-xs font-bold text-white"
          >
            N
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 w-56 rounded-xl border border-white/[0.1] bg-[#1b1f2e] p-2 shadow-xl">
              {email && (
                <p className="truncate px-2 py-1 text-[11px] text-slate-400">
                  {email}
                  <span className="ml-1 text-slate-600">· {role === "admin" ? "Admin" : "Viewer"}</span>
                </p>
              )}
              {role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 block rounded-lg px-2 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.06]"
                >
                  Admin panel
                </Link>
              )}
              <button
                type="button"
                onClick={() => signOut()}
                className="mt-1 block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold text-rose-300 hover:bg-white/[0.06]"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
