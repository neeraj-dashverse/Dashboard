"use client";

import { useOps } from "./OpsProvider";

/** Compact live-data status bar: source, unsaved edits, sheet links, actions. */
export function SyncStrip() {
  const { snap, flush, reset, busy } = useOps();
  const pending = snap.pendingWrites.filter((w) => w.status === "pending").length;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/[0.08] bg-[#121216] px-3 py-2 text-[12px]">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="font-semibold text-slate-200">Live</span>
        <span className="text-slate-500">· {snap.workingSource.spreadsheetName}</span>
      </span>

      <span className="text-slate-600">|</span>

      <span className="text-slate-400">
        {pending > 0 ? (
          <span className="font-semibold text-amber-300">{pending} unsaved edit{pending > 1 ? "s" : ""}</span>
        ) : (
          <span className="text-slate-500">All edits saved</span>
        )}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <a
          href={snap.workingSource.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-white/[0.1] px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white"
        >
          Master Tracker ↗
        </a>
        <a
          href={snap.assetsSource.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-white/[0.1] px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white"
        >
          Assets ↗
        </a>
        <button
          type="button"
          disabled={busy || pending === 0}
          onClick={() => flush()}
          className="rounded-md bg-gradient-to-r from-[#4361ee] to-[#d6293d] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40"
        >
          Sync to sheet{pending > 0 ? ` (${pending})` : ""}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => reset()}
          title="Re-pull latest rows from Google Sheets"
          className="rounded-md border border-white/[0.1] px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white disabled:opacity-40"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
