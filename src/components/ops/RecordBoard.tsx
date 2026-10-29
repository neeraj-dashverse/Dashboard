"use client";

import { Fragment, useMemo, useState } from "react";
import { formatDuration, promoRecords } from "@/lib/ops/selectors";
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
  const [openId, setOpenId] = useState<string | null>(null);

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
          Every promo, including closed ones. Initial duration is from Master Tracker. Final duration is the sum of part lengths. Days are from the first start to the last close.
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

      <div className="overflow-hidden rounded-xl border border-white/[0.08]">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Show</th>
              <th className="px-4 py-3 font-semibold">Promo</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Who worked</th>
              <th className="px-4 py-3 text-right font-semibold">Days</th>
              <th className="px-4 py-3 text-right font-semibold">Initial</th>
              <th className="px-4 py-3 text-right font-semibold">Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {shown.map((record) => {
              const open = openId === record.id;
              const people = [
                record.assetPeople ? `Assets ${record.assetPeople}` : "",
                ...record.parts.map(
                  (part) => `P${part.partNo} ${part.artist}${part.editor !== "—" ? ` / ${part.editor}` : ""}`
                ),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Fragment key={record.id}>
                  <tr className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : record.id)}
                        className="text-left font-semibold text-white hover:underline"
                      >
                        {open ? "▾ " : "▸ "}
                        {record.showName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-200">{record.promoName}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-400">{record.status || "—"}</td>
                    <td className="max-w-[280px] px-4 py-3 text-[12px] leading-5 text-slate-300">
                      {people || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      {record.days ?? "—"}
                      {record.assetDays != null && (
                        <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                          assets {record.assetDays}d
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      {duration(record.initialSec)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-white">
                      {duration(record.finalSec)}
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-white/[0.02]">
                      <td colSpan={7} className="px-4 py-3">
                        {record.parts.length === 0 ? (
                          <p className="text-[12px] text-slate-500">No production parts on the sheet.</p>
                        ) : (
                          <table className="w-full text-left text-[12px]">
                            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                              <tr>
                                <th className="py-1 pr-3 font-semibold">Part</th>
                                <th className="py-1 pr-3 font-semibold">Artist</th>
                                <th className="py-1 pr-3 font-semibold">Editor</th>
                                <th className="py-1 pr-3 font-semibold">Stage</th>
                                <th className="py-1 pr-3 text-right font-semibold">Days</th>
                                <th className="py-1 pr-3 text-right font-semibold">Length</th>
                                <th className="py-1 text-right font-semibold">Worked</th>
                              </tr>
                            </thead>
                            <tbody>
                              {record.parts.map((part) => (
                                <tr key={part.partNo} className="border-t border-white/[0.05]">
                                  <td className="py-1.5 pr-3 font-semibold text-white">P{part.partNo}</td>
                                  <td className="py-1.5 pr-3 text-slate-300">{part.artist}</td>
                                  <td className="py-1.5 pr-3 text-slate-300">{part.editor}</td>
                                  <td className="py-1.5 pr-3 text-slate-400">{part.stage}</td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-200">
                                    {part.days ?? "—"}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-200">
                                    {duration(part.lengthSec)}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums text-slate-200">
                                    {duration(part.workedSec)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
