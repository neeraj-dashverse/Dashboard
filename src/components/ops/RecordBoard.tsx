"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDmy, findDuration, formatClock, promoRecords } from "@/lib/ops/selectors";
import { useOps } from "./OpsProvider";

function when(value: string | null | undefined): string {
  if (!value) return "—";
  return formatDmy(value);
}

const fieldClass =
  "rounded-lg border border-white/[0.1] bg-[#222738] px-3 py-2 text-[13px] text-white";

function uniqueNames(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function promoKey(show: string, promo: string): string {
  return `${show}\u0000${promo}`;
}

function MultiFilter({
  label,
  emptyLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  emptyLabel: string;
  options: { key: string; title: string; hint?: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const picked = options.filter((option) => selected.includes(option.key));
  const summary =
    picked.length === 0 ? emptyLabel : picked.length === 1 ? picked[0].title : `${picked.length} ${label}`;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`${fieldClass} flex max-w-[280px] items-center gap-2 text-left`}
        aria-expanded={open}
        aria-label={summary}
      >
        <span className="truncate">{summary}</span>
        <span className="text-slate-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-white/[0.1] bg-[#222738] p-1 shadow-xl">
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full rounded px-2 py-1.5 text-left text-[12px] text-slate-400 hover:bg-white/[0.04]"
          >
            {emptyLabel}
          </button>
          {options.map((option) => (
            <label
              key={option.key}
              className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-white/[0.04]"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.key)}
                onChange={() => toggle(option.key)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block truncate text-[12px] text-slate-100">{option.title}</span>
                {option.hint && (
                  <span className="block truncate text-[10px] text-slate-500">{option.hint}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecordBoard() {
  const { snap } = useOps();
  const records = useMemo(() => promoRecords(snap), [snap]);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState<string[]>([]);
  const [promoFilters, setPromoFilters] = useState<string[]>([]);

  const durationById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const record of records) labels.set(record.id, formatClock(findDuration(snap, record.id)?.totalSec));
    return labels;
  }, [records, snap]);
  const shows = useMemo(() => uniqueNames(records.map((record) => record.showName)), [records]);
  const promoOptions = useMemo(() => {
    const pool = showFilters.length
      ? records.filter((record) => showFilters.includes(record.showName))
      : records;
    const seen = new Set<string>();
    const options: { key: string; title: string; hint: string }[] = [];
    for (const record of pool) {
      const key = promoKey(record.showName, record.promoName);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ key, title: record.promoName || "—", hint: record.showName });
    }
    return options.sort((a, b) => a.hint.localeCompare(b.hint) || a.title.localeCompare(b.title));
  }, [records, showFilters]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const promoKeys = new Set(promoFilters);
    return records.filter((record) => {
      if (showFilters.length && !showFilters.includes(record.showName)) return false;
      if (promoKeys.size && !promoKeys.has(promoKey(record.showName, record.promoName))) return false;
      if (!q) return true;
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
  }, [records, query, showFilters, promoFilters]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          PocketFM · Operations
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Record</h1>
        <p className="mt-1 text-[12px] text-slate-500">Click a show or promo for its full record.</p>
      </div>


      <div className="flex flex-wrap items-center gap-2">
        <MultiFilter
          label="shows"
          emptyLabel="All shows"
          options={shows.map((name) => ({ key: name, title: name }))}
          selected={showFilters}
          onChange={(next) => {
            setShowFilters(next);
            const allowed = new Set(
              records
                .filter((record) => next.length === 0 || next.includes(record.showName))
                .map((record) => promoKey(record.showName, record.promoName))
            );
            setPromoFilters((current) => current.filter((key) => allowed.has(key)));
          }}
        />
        <MultiFilter
          label="promos"
          emptyLabel="All promos"
          options={promoOptions}
          selected={promoFilters}
          onChange={setPromoFilters}
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search show, promo, or person"
          className={`${fieldClass} w-full max-w-md placeholder:text-slate-600`}
        />
      </div>

      <p className="text-[12px] text-slate-500">
        {shown.length} promo{shown.length === 1 ? "" : "s"}
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="min-w-full border-collapse text-left text-[12px]">
          <thead className="bg-[#222738] text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5">Show</th>
              <th className="whitespace-nowrap px-3 py-2.5">Promo</th>
              <th className="whitespace-nowrap px-3 py-2.5">Duration</th>
              <th className="whitespace-nowrap px-3 py-2.5">Pre-production start</th>
              <th className="whitespace-nowrap px-3 py-2.5">Pre-production end</th>
              <th className="whitespace-nowrap px-3 py-2.5">Production start</th>
              <th className="whitespace-nowrap px-3 py-2.5">Production end</th>
              <th className="whitespace-nowrap px-3 py-2.5">Sound date</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  No promos match.
                </td>
              </tr>
            ) : (
              shown.map((record) => (
                <tr
                  key={record.id}
                  className="border-t border-white/[0.06] bg-[#1a1e2b] hover:bg-white/[0.03]"
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
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {durationById.get(record.id) ?? "—"}
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
                    {when(record.productionEnd)}
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
