"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useOps } from "./ops/OpsProvider";

const navItems = [
  { href: "/ask", label: "Ask AI", icon: "✦" },
  { href: "/planner", label: "Calendar", icon: "▦" },
  { href: "/team", label: "Team", icon: "☰" },
  { href: "/productivity", label: "Productivity", icon: "◈" },
  { href: "/record", label: "Record", icon: "≡" },
];

function itemClass(active: boolean): string {
  return active
    ? "relative flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-[#4361ee]/20 to-[#d6293d]/15 px-3 py-2.5 text-sm font-bold text-white"
    : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-100";
}

export function Sidebar() {
  const { snap } = useOps();
  const [pathname, setPathname] = useState("");
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setPathname(window.location.pathname);
    const saved = window.localStorage.getItem("ops-nav-open");
    if (saved === "0") setOpen(false);
  }, []);

  function toggle() {
    setOpen((value) => {
      const next = !value;
      window.localStorage.setItem("ops-nav-open", next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={`relative shrink-0 overflow-hidden border-r border-white/[0.1] bg-[#161a26] transition-[width] duration-200 ${
        open ? "w-[220px]" : "w-12"
      }`}
    >
      <div className={`flex items-center ${open ? "gap-2 px-3 pt-4" : "justify-center pt-4"}`}>
        <button
          type="button"
          aria-label={open ? "Hide navigation" : "Show navigation"}
          aria-expanded={open}
          onClick={toggle}
          className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[4px] rounded-xl text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
        >
          <span className="block h-[2px] w-4 rounded-full bg-current" />
          <span className="block h-[2px] w-4 rounded-full bg-current" />
          <span className="block h-[2px] w-4 rounded-full bg-current" />
        </button>
        {open && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white">PocketFM Ops</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Dashverse</p>
          </div>
        )}
      </div>

      {open && (
        <>
          <nav className="mt-8 space-y-1 px-4">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Operations
            </p>
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setPathname(item.href)}
                  className={itemClass(active)}
                >
                  {active && (
                    <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-gradient-to-b from-[#4361ee] to-[#d6293d]" />
                  )}
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-6 left-4 right-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${snap.live ? "bg-emerald-400" : "bg-amber-400"}`} />
              {snap.live ? "Live" : "Sample data"} · {snap.workingSource.spreadsheetName}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">neeraj.d@dashverse.ai</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <a
                href={snap.workingSource.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-white/[0.1] px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-white"
              >
                Master Tracker ↗
              </a>
              <a
                href={snap.assetsSource.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-white/[0.1] px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-white"
              >
                Assets ↗
              </a>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
