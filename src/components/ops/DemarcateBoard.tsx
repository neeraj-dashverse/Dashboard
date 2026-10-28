"use client";

import { useMemo, useState } from "react";
import type { DemarcationResult } from "@/lib/demarcation";
import { CEILING_WORDS, PACE_WPM, formatRuntime, wordsToRuntimeSec } from "@/lib/demarcation";
import { SectionTitle, Kpi } from "./ui";

function QcBadge({ status }: { status: string }) {
  const tone =
    status === "Pass"
      ? "bg-emerald-500/20 text-emerald-300"
      : status.startsWith("FAIL")
        ? "bg-amber-500/20 text-amber-200"
        : status === "Fail"
          ? "bg-rose-500/20 text-rose-300"
          : "bg-white/10 text-slate-400";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
      {status}
    </span>
  );
}

export function DemarcateBoard() {
  const [sourceText, setSourceText] = useState("");
  const [scriptName, setScriptName] = useState("");
  const [epLabel, setEpLabel] = useState("EP 01");
  const [partCount, setPartCount] = useState<number | null>(null);
  const [result, setResult] = useState<DemarcationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceExport, setForceExport] = useState(false);

  async function analyze(nextPartCount?: number | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demarcate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          scriptName,
          epLabel,
          selectedPartCount: nextPartCount === undefined ? partCount : nextPartCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      if (data.selected) setPartCount(data.selected.partCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function download(format: "docx" | "md") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demarcate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          scriptName,
          epLabel,
          selectedPartCount: partCount,
          format,
          forceExport,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "docx"
          ? `${(scriptName || "script").replace(/\s+/g, "_")}_demarcation.docx`
          : "anomaly_log.md";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setSourceText(text);
      if (!scriptName) setScriptName(file.name.replace(/\.\w+$/, ""));
    };
    reader.readAsText(file);
  }

  const previewLines = useMemo(() => {
    if (!result?.selected) return [];
    return result.selected.parts.map((p) => ({
      part: p.partNo,
      ends: p.endsOnSlug,
      run: formatRuntime(p.runtimeSec),
      over: p.overCeiling,
    }));
  }, [result]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Scripts
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Script <span className="gradient-text">demarcation</span>
        </h1>
        <p className="mt-1 text-[12px] text-slate-500">
          Base script is source of truth · {PACE_WPM} wpm · ceiling {CEILING_WORDS} words (10:00) ·
          PocketFM stripped on export · nothing locked until you confirm
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <label className="block text-[11px] text-slate-500">
          Script name
          <input
            value={scriptName}
            onChange={(e) => setScriptName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#0e0e13] px-3 py-2 text-[13px] text-white"
            placeholder="SHOW · TITLE"
          />
        </label>
        <label className="block text-[11px] text-slate-500">
          Episode
          <input
            value={epLabel}
            onChange={(e) => setEpLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#0e0e13] px-3 py-2 text-[13px] text-white"
          />
        </label>
        <label className="block text-[11px] text-slate-500">
          Upload .txt (PDF paste text for now)
          <input
            type="file"
            accept=".txt,.md,text/plain"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-[12px] text-slate-400"
          />
        </label>
      </div>

      <textarea
        value={sourceText}
        onChange={(e) => setSourceText(e.target.value)}
        rows={14}
        placeholder={`Paste script here…

INT. APARTMENT — NIGHT
Narrator: She opens the door…
RAVI: (Emotion: Firm) We need to talk.`}
        className="w-full rounded-xl border border-white/[0.1] bg-[#0e0e13] px-3 py-3 font-mono text-[12px] text-slate-200 placeholder:text-slate-600"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !sourceText.trim()}
          onClick={() => analyze(null)}
          className="rounded-lg bg-gradient-to-r from-[#4361ee] to-[#d6293d] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "Working…" : "Build scene map + splits"}
        </button>
        {result && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => download("docx")}
              className="rounded-lg bg-white/[0.08] px-4 py-2 text-[12px] font-bold text-white"
            >
              Download .docx deck
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => download("md")}
              className="rounded-lg bg-white/[0.08] px-4 py-2 text-[12px] font-bold text-slate-200"
            >
              Download anomaly log
            </button>
            <label className="flex items-center gap-2 text-[11px] text-slate-400">
              <input
                type="checkbox"
                checked={forceExport}
                onChange={(e) => setForceExport(e.target.checked)}
              />
              Force export if fidelity ≠ 0 (visible override)
            </label>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {error}
        </p>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Kpi label="Scenes" value={result.scenes.length} />
            <Kpi
              label="Base spoken"
              value={`${result.baseSpokenWords}w`}
              tone="text-[#9bb0ff]"
            />
            <Kpi
              label="Runtime"
              value={formatRuntime(wordsToRuntimeSec(result.baseSpokenWords))}
            />
            <Kpi
              label="PS words (sep.)"
              value={result.psSpokenWords}
              tone="text-slate-300"
            />
            <Kpi
              label="PFM stripped"
              value={result.pfmStripCount}
              tone={result.pfmStripCount ? "text-amber-300" : "text-emerald-300"}
            />
          </div>

          {(!result.hasBaseScriptMarker || !result.hasPsMarker) && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
              {!result.hasPsMarker && !result.hasBaseScriptMarker
                ? "No PS marker and no Base Script marker — decide how the opening is treated (not assumed)."
                : !result.hasBaseScriptMarker
                  ? "No Base Script marker found."
                  : "No PS marker found (OK if script has none)."}
            </p>
          )}

          <section className="space-y-2">
            <SectionTitle
              title="1 · Scene map"
              hint="Shown before any split is locked — exhaustive search uses these boundaries only"
            />
            <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-white/[0.03] text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Slug</th>
                    <th className="px-3 py-2 text-right">Words</th>
                    <th className="px-3 py-2 text-right">Run</th>
                    <th className="px-3 py-2 text-right">Cumulative</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {result.scenes.map((s) => (
                    <tr key={s.index} className="text-slate-300">
                      <td className="px-3 py-1.5 tabular-nums">{s.index + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-white">{s.slug}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{s.spokenWords}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatRuntime(s.runtimeSec)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                        {s.cumulativeWords}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle
              title="2 · Trade-offs (exhaustive)"
              hint="Best shortest/longest per part count — pick one; overruns = FAIL accepted by direction"
            />
            <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-white/[0.03] text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Parts</th>
                    <th className="px-3 py-2 text-right">Shortest</th>
                    <th className="px-3 py-2 text-right">Longest</th>
                    <th className="px-3 py-2 text-right">Over</th>
                    <th className="px-3 py-2">Near short</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {result.tradeoffs.map((t) => (
                    <tr
                      key={t.partCount}
                      className={
                        result.selected?.partCount === t.partCount
                          ? "bg-[#4361ee]/10 text-white"
                          : "text-slate-300"
                      }
                    >
                      <td className="px-3 py-1.5 font-semibold">{t.partCount}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatRuntime(t.shortestSec)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatRuntime(t.longestSec)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{t.maxOverCeiling}</td>
                      <td className="px-3 py-1.5">{t.anyNearShort ? "yes" : "no"}</td>
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setPartCount(t.partCount);
                            analyze(t.partCount);
                          }}
                          className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-slate-200"
                        >
                          Use
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {result.selected && (
            <section className="space-y-2">
              <SectionTitle title="Selected parts" hint={result.structuralFinding} />
              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-[#1F2A44]/80 text-[10px] uppercase text-white/80">
                    <tr>
                      <th className="px-3 py-2">Part</th>
                      <th className="px-3 py-2">Scenes</th>
                      <th className="px-3 py-2 text-right">Run</th>
                      <th className="px-3 py-2">Ends on</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {result.selected.parts.map((p, i) => (
                      <tr
                        key={p.partNo}
                        className={i % 2 ? "bg-[#F7F2E7]/5" : ""}
                      >
                        <td className="px-3 py-1.5 font-bold text-[#ff8a98]">{p.partNo}</td>
                        <td className="px-3 py-1.5 text-slate-300">
                          {p.sceneFrom}→{p.sceneTo}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right tabular-nums font-semibold ${
                            p.overCeiling ? "text-[#ff8a98]" : "text-white"
                          }`}
                        >
                          {formatRuntime(p.runtimeSec)}
                          {p.overCeiling ? " ⚠" : ""}
                        </td>
                        <td className="px-3 py-1.5 text-slate-400">{p.endsOnSlug}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12px] text-slate-400">
                <p className="font-bold text-[#ff8a98]">Confirm before locking:</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                  {result.openDecisions.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                  {!result.openDecisions.length && <li>No open decisions listed.</li>}
                </ol>
              </div>
            </section>
          )}

          <section className="space-y-2">
            <SectionTitle title="QC" hint="Never Pass if not run · ceiling overrun ≠ Pass" />
            <div className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.08]">
              {result.qc.map((q) => (
                <div key={q.id} className="flex flex-wrap items-start gap-3 px-3 py-2">
                  <QcBadge status={q.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-white">{q.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {q.ran ? "Ran" : "Not run"} · {q.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-600">
              Docx page-1 image preview (LibreOffice) not wired yet — download the deck and
              open locally before treating as clean. Boundary preview:
              {previewLines.map((l) => (
                <span key={l.part} className="ml-2 text-slate-400">
                  P{l.part} ends «{l.ends.slice(0, 24)}» {l.run}
                  {l.over ? " ⚠" : ""}
                </span>
              ))}
            </p>
          </section>

          {result.anomalies.length > 0 && (
            <section className="space-y-2">
              <SectionTitle title="Anomalies" hint="Proposed only — never auto-applied" />
              <ul className="space-y-2">
                {result.anomalies.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-white/[0.08] bg-[#121216] px-3 py-2 text-[12px]"
                  >
                    <p className="font-bold text-amber-200">
                      {a.id} · {a.kind} · {a.status}
                    </p>
                    <p className="mt-0.5 text-slate-300">{a.message}</p>
                    {a.proposedFix && (
                      <p className="mt-0.5 text-slate-500">Fix: {a.proposedFix}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
