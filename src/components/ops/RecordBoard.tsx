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

function when(value: string | null | undefined): string {
  if (!value) return "—";
  return formatDmy(value);
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
          List of every promo. Click the show or promo name for full details.
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

      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="min-w-full border-collapse text-left text-[12px]">
          <thead className="bg-[#121216] text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5">Show</th>
              <th className="whitespace-nowrap px-3 py-2.5">Promo</th>
              <th className="whitespace-nowrap px-3 py-2.5">Worked</th>
              <th className="whitespace-nowrap px-3 py-2.5">Asset start</th>
              <th className="whitespace-nowrap px-3 py-2.5">Asset end</th>
              <th className="whitespace-nowrap px-3 py-2.5">Animation start</th>
              <th className="whitespace-nowrap px-3 py-2.5">Sound end</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No promos match.
                </td>
              </tr>
            ) : (
              shown.map((record) => (
                <tr
                  key={record.id}
                  className="border-t border-white/[0.06] bg-[#0c0c10] hover:bg-white/[0.03]"
                >
                  <td className="max-w-[180px] px-3 py-2.5">
                    <Link
                      href={`/record/${encodeURIComponent(record.id)}`}
                      className="block truncate font-semibold text-white hover:underline"
                      title={record.showName}
                    >
                      {record.showName || "—"}
                    </Link>
                  </td>
                  <td className="max-w-[200px] px-3 py-2.5">
                    <Link
                      href={`/record/${encodeURIComponent(record.id)}`}
                      className="block truncate text-slate-300 hover:text-white hover:underline"
                      title={record.promoName}
                    >
                      {record.promoName || "—"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-200">
                    {duration(record.workedSec)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {when(record.assetStart)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {when(record.assetEnd)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {when(record.animationStart)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {when(record.soundEnd)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
