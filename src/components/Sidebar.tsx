"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Today", icon: "◉" },
  { href: "/tasks", label: "Tasks", icon: "☑" },
  { href: "/pipeline", label: "Pipeline", icon: "▤" },
  { href: "/planner", label: "Calendar", icon: "▦" },
  { href: "/plan", label: "Plan", icon: "◷" },
  { href: "/team", label: "Team", icon: "☰" },
  { href: "/demarcate", label: "Demarcate", icon: "✎" },
];

function itemClass(active: boolean): string {
  return active
    ? "relative flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-[#4361ee]/20 to-[#d6293d]/15 px-3 py-2.5 text-sm font-bold text-white"
    : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-100";
}

export function Sidebar() {
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  return (
    <aside className="relative hidden w-[220px] shrink-0 border-r border-white/[0.07] bg-[#0e0e13] px-4 py-6 lg:block">
      <div className="flex items-center gap-3 px-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4361ee] to-[#d6293d] text-sm font-bold text-white shadow-lg shadow-[#d6293d]/20">
          D
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">PocketFM Ops</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Dashverse</p>
        </div>
      </div>

      <nav className="mt-10 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          Operations
        </p>
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/promo")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
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

      <div className="absolute bottom-6 ml-3 hidden w-[180px] rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 lg:block">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dashverse Ops</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-400">
          Live from Google Sheets · neeraj.d@dashverse.ai
        </p>
      </div>
    </aside>
  );
}
