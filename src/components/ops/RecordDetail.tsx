"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDmy, formatDuration, STAGE_LABEL } from "@/lib/ops/selectors";
import type { Part, Promo, QualityReview } from "@/lib/ops/types";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

function duration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "";
  return formatDuration(seconds);
}

function when(value: string | null | undefined): string {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDmy(value) : value;
}

function Chip({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const text = value == null || value === "" ? "" : String(value);
  if (!text) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-slate-200">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-0.5 block max-w-[220px] truncate">{text}</span>
    </div>
  );
}

function uniqueParts(parts: Part[]): Part[] {
  const byNo = new Map<number, Part>();
  for (const part of parts) {
    const prev = byNo.get(part.partNo);
    if (!prev) {
      byNo.set(part.partNo, part);
      continue;
    }
    const prevClose = prev.soundEndDate ?? prev.correctionEndDate ?? "";
    const nextClose = part.soundEndDate ?? part.correctionEndDate ?? "";
    if (nextClose > prevClose || (!prev.artist && part.artist)) byNo.set(part.partNo, part);
  }
  return [...byNo.values()].sort((a, b) => a.partNo - b.partNo);
}

function krockButtons(reviews: QualityReview[], partNo: number) {
  const seen = new Set<string>();
  const out: { url: string; pass: string }[] = [];
  for (const review of reviews) {
    if (review.partNo !== partNo || !review.krockLink) continue;
    if (seen.has(review.krockLink)) continue;
    seen.add(review.krockLink);
    out.push({ url: review.krockLink, pass: review.versionCorrection ?? "" });
  }
  return out;
}

export function RecordDetail({ promoId }: { promoId: string }) {
  const { snap } = useOps();
  const base = promoId.split("#")[0];
  const promo =
    snap.promos.find((item) => item.id === promoId) ??
    snap.promos.find((item) => item.id === base) ??
    snap.promos.find((item) => item.id.split("#")[0] === base);
  const parts = uniqueParts(
    snap.parts.filter((part) => part.promoId === base || part.promoId === promo?.id)
  );
  const reviews = snap.qualityReviews.filter((review) => review.promoId === base);
  const remarks = snap.planRemarks.filter((remark) => remark.promoId === base);
  const plans = snap.plannerCells.filter((cell) => cell.promoId === base);

  if (!promo && parts.length === 0) {
    return (
      <div className="space-y-3">
        <Link href="/record" className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
          ← Record
        </Link>
        <p className="text-[13px] text-slate-400">That promo is not on the sheets.</p>
      </div>
    );
  }

  const show = promo?.showName || "Promo";
  const name = promo?.promoName || "";
  const asset = promo?.assetTeam;
  const pre = promo?.preProd;
  const links = uniqueLinks(promo);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/record" className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
            ← Record
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">{show}</h1>
          {name && <p className="text-[14px] text-slate-400">{name}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {promo?.trackerStatus && <Pill>{promo.trackerStatus}</Pill>}
          {promo?.cps && <Pill>Cps {promo.cps}</Pill>}
          {promo?.priority && <Pill>{promo.priority}</Pill>}
        </div>
      </div>
      <SyncStrip />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Initial" value={duration(promo?.initialDurationSec) || "—"} />
        <Stat label="Final" value={duration(promo?.finalAssetLengthSec) || sumLength(parts) || "—"} />
        <Stat label="Parts" value={String(parts.length || "—")} />
        <Stat
          label="Assets"
          value={asset?.totalDays != null ? `${asset.totalDays} days` : pre?.status || "—"}
        />
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#4361ee]/30 bg-[#4361ee]/15 px-3 py-1.5 text-[12px] font-semibold text-[#d5deff] hover:bg-[#4361ee]/25"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <InfoCard
          title="Assets"
          lines={[
            asset?.assetsStatus,
            [asset?.artist1, asset?.artist2, asset?.artist3, asset?.artLead].filter(Boolean).join(", "),
            asset?.startDate || asset?.endDate
              ? `${when(asset?.startDate) || "—"} → ${when(asset?.endDate) || "—"}`
              : "",
            asset?.correctionsEndDate ? `Corrections closed ${when(asset.correctionsEndDate)}` : "",
            asset?.assetsCount,
          ]}
          note={[asset?.remarks, asset?.dashverseNotes].filter(Boolean).join("\n")}
        />
        <InfoCard
          title="Pre-production"
          lines={[
            pre?.status,
            pre?.artist,
            pre?.totalAssets != null ? `${pre.totalAssets} assets` : "",
            pre?.plannedDate ? `Planned ${when(pre.plannedDate)}` : "",
            pre?.closedDate ? `Closed ${when(pre.closedDate)}` : "",
          ]}
          note={pre?.remarksLog.map((entry) => entry.body).join("\n") ?? ""}
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-[13px] font-bold text-white">Parts</h2>
        {parts.length === 0 ? (
          <p className="text-[12px] text-slate-500">No production parts.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {parts.map((part) => (
              <article key={part.partNo} className="rounded-xl border border-white/[0.08] bg-[#121216] p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-bold text-white">Part {part.partNo}</p>
                  <Pill>
                    {STAGE_LABEL[part.stage]}
                    {part.team === "agency" ? " · Agency" : ""}
                  </Pill>
                </div>
                <p className="mt-2 text-[13px] text-slate-200">
                  {part.artist || "No artist"}
                  {part.editors ? <span className="text-slate-500"> · {part.editors}</span> : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip label="Length" value={duration(part.durationSec)} />
                  <Chip label="Worked" value={duration(part.workedDurationSec)} />
                  <Chip label="Days" value={part.days} />
                  <Chip label="Animation" value={span(part.aniStartDate, part.aniCloseDate)} />
                  <Chip label="Edit" value={when(part.editCloseDate)} />
                  <Chip label="Correction" value={span(part.correctionStartDate, part.correctionEndDate)} />
                  <Chip label="Sound" value={when(part.soundEndDate)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {krockButtons(reviews, part.partNo).map((krock) => (
                    <a
                      key={krock.url}
                      href={krock.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-[#9bb0ff] hover:bg-white/[0.1]"
                    >
                      Krock{krock.pass ? ` · ${krock.pass}` : ""}
                    </a>
                  ))}
                </div>
                {part.remarks && <p className="mt-3 text-[12px] leading-5 text-slate-400">{part.remarks}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      {(plans.length > 0 || remarks.length > 0 || promo?.remarks || promo?.notes || promo?.comments) && (
        <section className="rounded-xl border border-white/[0.08] bg-[#121216] p-4">
          <h2 className="text-[13px] font-bold text-white">Notes and plan</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {uniquePlans(plans).map((cell) => (
              <Chip
                key={`${cell.partNo}-${cell.date}-${cell.text}`}
                label={cell.partNo ? `P${cell.partNo}` : "Assets"}
                value={`${when(cell.date)} · ${cell.text}`}
              />
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {uniqueText([promo?.comments, promo?.notes, promo?.remarks, ...remarks.map((item) => item.body)]).map(
              (text) => (
                <p key={text} className="text-[12px] leading-5 text-slate-300">
                  {text}
                </p>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#121216] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-[16px] font-bold text-white">{value}</p>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
      {children}
    </span>
  );
}

function InfoCard({
  title,
  lines,
  note,
}: {
  title: string;
  lines: (string | null | undefined)[];
  note: string;
}) {
  const facts = lines.map((line) => line?.trim()).filter((line): line is string => !!line);
  const extra = note.trim();
  if (facts.length === 0 && !extra) return null;
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#121216] p-4">
      <h2 className="text-[13px] font-bold text-white">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {facts.map((line) => (
          <span key={line} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-slate-200">
            {line}
          </span>
        ))}
      </div>
      {extra && <p className="mt-3 whitespace-pre-wrap text-[12px] leading-5 text-slate-400">{extra}</p>}
    </section>
  );
}

function span(start: string | null, end: string | null): string {
  const a = when(start);
  const b = when(end);
  if (a && b) return `${a} → ${b}`;
  return b || a;
}

function sumLength(parts: Part[]): string {
  const total = parts.reduce((sum, part) => sum + (part.durationSec || 0), 0);
  return duration(total);
}

function uniqueLinks(promo: Promo | undefined) {
  if (!promo) return [];
  const asset = promo.assetTeam;
  const candidates = [
    ["Krock 5 min", promo.krockLink5Min],
    ["Final renders", promo.finalRendersLink],
    ["Project files", promo.projectFilesLink],
    ["Final files", promo.finalCorrectedFiles],
    ["Assets", promo.assetsLink],
    ["Asset map", asset?.assetMapLink],
    ["Asset canvas", asset?.assetCanvasLink],
    ["Drive", asset?.assetsDriveLink],
    ["Canvas", promo.canvasLink],
    ["Script", promo.workingScriptLink || promo.scriptLink],
    ["Agency script", promo.agencyScriptLink],
    ["Demarcated", promo.demarcatedScriptLink],
    ["Show", promo.showLink],
    ["VO", promo.voSamples],
    ["Video", promo.videoSamples],
  ] as const;
  const seen = new Set<string>();
  const out: { label: string; href: string }[] = [];
  for (const [label, value] of candidates) {
    if (!value || !/^https?:\/\//i.test(value) || seen.has(value)) continue;
    seen.add(value);
    out.push({ label, href: value });
  }
  return out;
}

function uniquePlans(
  cells: { partNo: number; date: string; text: string }[]
) {
  const seen = new Set<string>();
  return cells.filter((cell) => {
    const key = `${cell.partNo}|${cell.date}|${cell.text.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueText(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value?.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}
