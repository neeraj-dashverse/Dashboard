"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDmy, formatDuration, promoRecords } from "@/lib/ops/selectors";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

function duration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "—";
  return formatDuration(seconds);
}

export function RecordBoard() {
  const { snap } = useOps();
  const records = useMemo(() => promoRecords(snap), [snap]);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((record) => {
      const people = [
        record.assetPeople,
        ...record.parts.flatMap((part) => [part.artist, part.editor]),
      ]
        .join(" ")
        .toLowerCase();
      return (
        record.showName.toLowerCase().includes(q) ||
        record.promoName.toLowerCase().includes(q) ||
        people.includes(q)
      );
    });
  }, [records, query]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          PocketFM · Operations
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Record</h1>
        <p className="mt-1 max-w-3xl text-[12px] leading-5 text-slate-500">
          Newest close date first. Open a card for who worked, the days, and each part.
        </p>
      </div>

      <SyncStrip />

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search show, promo, or person"
        className="w-full max-w-md rounded-lg border border-white/[0.1] bg-[#121216] px-3 py-2 text-[13px] text-white placeholder:text-slate-600"
      />

      <p className="text-[12px] text-slate-500">
        {shown.length} promo{shown.length === 1 ? "" : "s"}
      </p>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((record) => {
          return (
            <Link
              key={record.id}
              href={`/record/${encodeURIComponent(record.id)}`}
              className="rounded-xl border border-white/[0.08] bg-[#121216] px-3 py-3 text-left hover:border-white/[0.16]"
            >
              <p className="truncate text-[13px] font-bold text-white">{record.showName}</p>
              <p className="truncate text-[12px] text-slate-400">{record.promoName}</p>
              <p className="mt-2 text-[12px] font-semibold text-slate-200">
                {record.closedOn ? `Closed ${formatDmy(record.closedOn)}` : "Still open"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {record.days != null ? `${record.days} days` : "Days —"}
                {" · Initial "}
                {duration(record.initialSec)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {record.finalRendersLink ? "Final render" : "No final render"}
                {" · "}
                {record.projectFilesLink ? "Project files" : "No project files"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
