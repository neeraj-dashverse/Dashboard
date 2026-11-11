"use client";

import { useOps } from "./OpsProvider";

/** Compact live-data status bar: source, unsaved edits, sheet links, actions. */
export function SyncStrip() {
  const { snap, reset, busy } = useOps();
  const live = snap.live;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-amber-400"}`} />
        <span className="font-semibold text-slate-400">{live ? "Live" : "Sample data"}</span>
        <span className="text-slate-600">· {snap.workingSource.spreadsheetName}</span>
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => reset()}
        title="Re-pull latest rows from Google Sheets"
        className="rounded-full border border-white/[0.1] px-2 py-0.5 font-semibold text-slate-500 hover:text-white disabled:opacity-40"
      >
        {busy ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
