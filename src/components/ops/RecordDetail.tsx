"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { delayDays, findDuration, formatClock, formatDmy, formatDuration, STAGE_LABEL } from "@/lib/ops/selectors";
import type { AssetTeamRow, Part, PreProdAssetRow, Promo, QualityReview } from "@/lib/ops/types";
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
  const [openParts, setOpenParts] = useState<number[]>([]);
  const [assetsOpen, setAssetsOpen] = useState(false);
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
  const plans = snap.plannerCells.filter(
    (cell) => cell.promoId === base || cell.promoId.split("#")[0] === base || cell.promoId === promo?.id
  );

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
  const assetStart = when(asset?.startDate || pre?.startDate);
  const assetEnd = when(asset?.correctionsEndDate || asset?.endDate || pre?.closedDate);
  const animationStarts = parts
    .map((part) => part.aniStartDate)
    .filter((date): date is string => !!date)
    .sort();
  const correctionEnds = parts
    .map((part) => part.correctionEndDate)
    .filter((date): date is string => !!date)
    .sort();
  const soundEnds = parts
    .map((part) => part.soundEndDate)
    .filter((date): date is string => !!date)
    .sort();
  const workedTotal = parts.reduce((sum, part) => sum + (part.workedDurationSec || 0), 0);
  const sheetDuration = promo ? findDuration(snap, promo.id) : undefined;
  const assetRows = assetStageRows(
    asset?.correctionsEndDate || asset?.endDate || pre?.closedDate,
    pre?.plannedDate,
    snap.today
  );

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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Duration" value={formatClock(sheetDuration?.totalSec)} />
        <Stat label="With CTA" value={formatClock(sheetDuration?.workedWithCtaSec)} />
        <Stat label="Total worked" value={duration(workedTotal) || "—"} />
        <Stat label="Pre-production start" value={assetStart || "—"} />
        <Stat label="Pre-production end" value={assetEnd || "—"} />
        <Stat label="Production start" value={when(animationStarts[0]) || "—"} />
        <Stat label="Production end" value={when(correctionEnds[correctionEnds.length - 1]) || "—"} />
        <Stat label="Sound date" value={when(soundEnds[soundEnds.length - 1]) || "—"} />
        <Stat label="Initial from parts" value={sumLength(parts) || "—"} />
        <Stat label="Parts" value={String(parts.length || "—")} />
        <Stat
          label="Pre-production"
          value={asset?.totalDays != null ? `${asset.totalDays} days` : pre?.status || "—"}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <FileLink label="Final render" href={promo?.finalRendersLink} />
        <FileLink label="Project files" href={promo?.projectFilesLink} />
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

      <InfoCard
        title="Pre-production"
        lines={preproductionLines(asset, pre)}
        note={uniqueText([
          asset?.remarks,
          asset?.dashverseNotes,
          asset?.notes,
          pre?.remarksLog.map((entry) => entry.body).join("\n"),
        ]).join("\n")}
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-bold text-white">Parts</h2>
          <button
            type="button"
            onClick={() => setAssetsOpen((value) => !value)}
            className="rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#9bb0ff] hover:bg-white/[0.1]"
          >
            {assetsOpen ? "Hide asset dates" : "Asset dates"}
          </button>
        </div>
        {assetsOpen && <DateTable rows={assetRows} />}
        {parts.length === 0 ? (
          <p className="text-[12px] text-slate-500">No production parts.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {parts.map((part) => (
              <article key={part.partNo} className="rounded-xl border border-white/[0.08] bg-[#222738] p-4">
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
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Chip label="Length" value={duration(part.durationSec)} />
                  <Chip label="Worked" value={duration(part.workedDurationSec)} />
                  <Chip label="Days" value={part.days} />
                  <button
                    type="button"
                    onClick={() =>
                      setOpenParts((current) =>
                        current.includes(part.partNo)
                          ? current.filter((partNo) => partNo !== part.partNo)
                          : [...current, part.partNo]
                      )
                    }
                    className="rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#9bb0ff] hover:bg-white/[0.1]"
                  >
                    {openParts.includes(part.partNo) ? "Hide dates" : "Dates"}
                  </button>
                </div>
                {openParts.includes(part.partNo) && (
                  <div className="mt-3">
                    <DateTable rows={partStageRows(part, plans, snap.today)} />
                  </div>
                )}
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

      {uniqueText([promo?.comments, promo?.notes, promo?.remarks, ...remarks.map((item) => item.body)]).length > 0 && (
        <section className="rounded-xl border border-white/[0.08] bg-[#222738] p-4">
          <h2 className="text-[13px] font-bold text-white">Notes</h2>
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

function FileLink({ label, href }: { label: string; href: string | null | undefined }) {
  if (href && /^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="rounded-xl border border-[#4361ee]/40 bg-[#4361ee]/15 px-4 py-3 text-[14px] font-bold text-white hover:bg-[#4361ee]/25"
      >
        {label}
        <span className="mt-1 block text-[11px] font-medium text-[#c5d0ff]">PocketFM sheet</span>
      </a>
    );
  }
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#222738] px-4 py-3 text-[14px] font-bold text-slate-500">
      {label}
      <span className="mt-1 block text-[11px] font-medium text-slate-600">Not on the PocketFM sheet</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#222738] px-3 py-3">
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

function preproductionLines(
  asset: AssetTeamRow | null | undefined,
  pre: PreProdAssetRow | null | undefined
): string[] {
  const people = uniqueText([
    [asset?.artist1, asset?.artist2, asset?.artist3].filter(Boolean).join(", "),
    pre?.artist,
  ]);
  const start = when(asset?.startDate || pre?.startDate);
  const end = when(asset?.correctionsEndDate || asset?.endDate || pre?.closedDate);
  const planned = when(pre?.plannedDate);
  const count =
    asset?.assetsCount || (pre?.totalAssets != null ? `${pre.totalAssets} assets` : "");
  const days =
    asset?.totalDays != null
      ? `${asset.totalDays} days`
      : asset?.productionDays != null
        ? `${asset.productionDays} days`
        : "";
  return uniqueText([
    asset?.assetsStatus || pre?.status || "",
    ...people,
    start && end ? `${start} → ${end}` : start || end,
    planned && planned !== end ? `Planned ${planned}` : "",
    count,
    days,
  ]);
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
    <section className="rounded-xl border border-white/[0.08] bg-[#222738] p-4">
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

function planIso(
  plans: { partNo: number; date: string; text: string }[],
  partNo: number,
  re: RegExp
): string | null {
  return (
    plans
      .filter((cell) => cell.partNo === partNo && re.test(cell.text))
      .map((cell) => cell.date)
      .sort()[0] ?? null
  );
}

function delayLabel(
  planned: string | null | undefined,
  closed: string | null | undefined,
  today: string
): string {
  const days = delayDays(planned, closed, today);
  if (days == null) return "—";
  return String(days);
}

type StageDate = { key: string; stage: string; planned: string; closed: string; delayed: string };

function assetStageRows(
  assetEnd: string | null | undefined,
  assetPlanned: string | null | undefined,
  today: string
): StageDate[] {
  const show = (value: string | null | undefined) => (value ? formatDmy(value) : "—");
  return [
    {
      key: "assets",
      stage: "Assets",
      planned: show(assetPlanned),
      closed: show(assetEnd),
      delayed: delayLabel(assetPlanned, assetEnd, today),
    },
  ];
}

function partStageRows(
  part: Part,
  plans: { partNo: number; date: string; text: string }[],
  today: string
): StageDate[] {
  const show = (value: string | null | undefined) => (value ? formatDmy(value) : "—");
  const rough = planIso(plans, part.partNo, /rough cut|first cut|first animation|first edit/i);
  const finalCut = planIso(plans, part.partNo, /final cut|second cut|correction close/i);
  const sound = planIso(plans, part.partNo, /sound/i);
  return [
    {
      key: "ani",
      stage: "Animation",
      planned: show(rough),
      closed: show(part.aniCloseDate),
      delayed: delayLabel(rough, part.aniCloseDate, today),
    },
    {
      key: "edit",
      stage: "Edit",
      planned: show(rough),
      closed: show(part.editCloseDate),
      delayed: delayLabel(rough, part.editCloseDate, today),
    },
    {
      key: "cor",
      stage: "Correction",
      planned: show(finalCut),
      closed: show(part.correctionEndDate),
      delayed: delayLabel(finalCut, part.correctionEndDate, today),
    },
    {
      key: "sound",
      stage: "Sound",
      planned: show(sound),
      closed: show(part.soundEndDate),
      delayed: delayLabel(sound, part.soundEndDate, today),
    },
    { key: "rough", stage: "Rough cut", planned: show(rough), closed: "—", delayed: "—" },
    { key: "final", stage: "Final cut", planned: show(finalCut), closed: "—", delayed: "—" },
  ];
}

function DateTable({ rows }: { rows: StageDate[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
      <table className="min-w-full border-collapse text-left text-[12px]">
        <thead className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2">Stage</th>
            <th className="whitespace-nowrap px-3 py-2">Planned</th>
            <th className="whitespace-nowrap px-3 py-2">Closed</th>
            <th className="whitespace-nowrap px-3 py-2">Delayed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-white/[0.06]">
              <td className="whitespace-nowrap px-3 py-2 font-semibold text-white">{row.stage}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-300">{row.planned}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-300">{row.closed}</td>
              <td
                className={`whitespace-nowrap px-3 py-2 font-semibold ${
                  row.delayed !== "—" && row.delayed !== "0" ? "text-rose-200" : "text-slate-300"
                }`}
              >
                {row.delayed === "—" || row.delayed === "0" ? row.delayed : `${row.delayed}d`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
