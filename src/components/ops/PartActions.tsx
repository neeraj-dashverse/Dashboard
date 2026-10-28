"use client";

import { useState } from "react";
import { useOps } from "./OpsProvider";

export function PartActions({ partId }: { partId: string }) {
  const { snap, act, busy } = useOps();
  const [open, setOpen] = useState(false);
  const part = snap.parts.find((p) => p.id === partId);
  if (!part || part.stage === "delivered") return null;

  return (
    <div className="relative flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => act({ type: "flag", partId, flagged: !part.flagged })}
        className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
          part.flagged
            ? "bg-amber-500/20 text-amber-300"
            : "bg-white/[0.05] text-slate-400 hover:text-white"
        }`}
      >
        {part.flagged ? "Flagged" : "Flag"}
      </button>
      {part.blocked ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => act({ type: "unblock", partId })}
          className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300"
        >
          Unblock
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            act({
              type: "escalate",
              partId,
              note: "Escalated from Today",
            })
          }
          className="rounded-md bg-rose-500/15 px-2 py-1 text-[11px] font-semibold text-rose-300"
        >
          Escalate
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-gradient-to-r from-[#4361ee]/25 to-[#d6293d]/20 px-2 py-1 text-[11px] font-semibold text-white"
      >
        Reassign
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-white/[0.1] bg-[#16161c] shadow-xl">
          {snap.animators.map((a) => (
            <button
              key={a.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-[12px] text-slate-200 hover:bg-white/[0.06]"
              onClick={async () => {
                await act({ type: "reassign", partId, toArtistId: a.id });
                setOpen(false);
              }}
            >
              {a.name}
              <span className="ml-1 text-[10px] text-slate-500">
                {a.team === "agency" ? "agency" : "in-house"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
