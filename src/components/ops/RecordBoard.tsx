"use client";

import { useMemo, useState } from "react";
import { formatDmy, formatDuration, promoRecords, type PromoRecord } from "@/lib/ops/selectors";
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

      {shown.find((record) => record.id === openId) && (
        <RecordDetail record={shown.find((record) => record.id === openId)!} />
      )}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((record) => {
          const open = openId === record.id;
          return (
            <button
              key={record.id}
              type="button"
              onClick={() => setOpenId(open ? null : record.id)}
              className={`rounded-xl border px-3 py-3 text-left ${
                open
                  ? "border-[#9bb0ff]/50 bg-[#1d2447]"
                  : "border-white/[0.08] bg-[#121216] hover:border-white/[0.16]"
              }`}
            >
              <p className="truncate text-[13px] font-bold text-white">{record.showName}</p>
              <p className="truncate text-[12px] text-slate-400">{record.promoName}</p>
              <p className="mt-2 text-[12px] font-semibold text-slate-200">
                {record.closedOn ? `Closed ${formatDmy(record.closedOn)}` : "Still open"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {record.days != null ? `${record.days} days` : "Days —"}
                {" · "}
                {duration(record.initialSec)} → {duration(record.finalSec)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecordDetail({ record }: { record: PromoRecord }) {
  const people = [
    record.assetPeople ? `Assets: ${record.assetPeople}` : "",
    ...record.parts.map((part) => `P${part.partNo}: ${part.artist}${part.editor !== "—" ? ` / ${part.editor}` : ""}`),
  ].filter(Boolean);

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#121216] p-4">
      <p className="text-[15px] font-bold text-white">
        {record.showName} · {record.promoName}
      </p>
      <p className="mt-1 text-[12px] text-slate-400">
        {record.status || "—"}
        {record.closedOn ? ` · Closed ${formatDmy(record.closedOn)}` : " · Still open"}
        {record.days != null ? ` · ${record.days} days` : ""}
        {record.assetDays != null ? ` · assets ${record.assetDays} days` : ""}
      </p>
      <p className="mt-2 text-[12px] text-slate-300">
        Initial {duration(record.initialSec)} · Final {duration(record.finalSec)}
      </p>
      <p className="mt-2 text-[12px] leading-5 text-slate-400">{people.join(" · ") || "No people on the sheet."}</p>

      {record.parts.length === 0 ? (
        <p className="mt-3 text-[12px] text-slate-500">No production parts on the sheet.</p>
      ) : (
        <table className="mt-3 w-full text-left text-[12px]">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-semibold">Part</th>
              <th className="py-1 pr-3 font-semibold">Artist</th>
              <th className="py-1 pr-3 font-semibold">Editor</th>
              <th className="py-1 pr-3 font-semibold">Stage</th>
              <th className="py-1 pr-3 font-semibold">Closed</th>
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
                <td className="py-1.5 pr-3 text-slate-300">
                  {part.closedOn ? formatDmy(part.closedOn) : "—"}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-200">{part.days ?? "—"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-200">
                  {duration(part.lengthSec)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-200">{duration(part.workedSec)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
