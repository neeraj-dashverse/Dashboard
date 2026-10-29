"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDmy, formatDuration, STAGE_LABEL } from "@/lib/ops/selectors";
import type { Part } from "@/lib/ops/types";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

function date(value: string | null | undefined): string {
  if (!value) return "";
  return formatDmy(value);
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  const text = value == null || value === "" ? "" : String(value);
  if (!text || text === "—") return null;
  const href = /^https?:\/\//i.test(text) ? text : null;
  return (
    <div className="grid gap-1 border-b border-white/[0.05] py-2 sm:grid-cols-[180px_1fr] sm:gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="break-all text-[13px] text-[#9bb0ff] hover:underline">
          {text}
        </a>
      ) : (
        <p className="whitespace-pre-wrap text-[13px] text-slate-200">{text}</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#121216] p-4">
      <h2 className="text-[13px] font-bold text-white">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function RecordDetail({ promoId }: { promoId: string }) {
  const { snap } = useOps();
  const promo =
    snap.promos.find((item) => item.id === promoId) ??
    snap.promos.find((item) => item.id.split("#")[0] === promoId);
  const parts = snap.parts
    .filter((part) => part.promoId === (promo?.id ?? promoId) || part.promoId === promoId.split("#")[0])
    .sort((a, b) => a.partNo - b.partNo);
  const reviews = snap.qualityReviews.filter(
    (review) => review.promoId === (promo?.id.split("#")[0] ?? promoId.split("#")[0])
  );
  const remarks = snap.planRemarks.filter(
    (remark) => remark.promoId === (promo?.id.split("#")[0] ?? promoId.split("#")[0])
  );
  const plans = snap.plannerCells.filter(
    (cell) => cell.promoId === (promo?.id.split("#")[0] ?? promoId.split("#")[0])
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

  const show = promo?.showName || parts[0]?.promoId.split("|")[0] || "Promo";
  const name = promo?.promoName || parts[0]?.promoId.split("|")[1] || "";
  const asset = promo?.assetTeam;
  const pre = promo?.preProd;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/record" className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
          ← Record
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
          {show}
          {name ? <span className="text-slate-400"> · {name}</span> : null}
        </h1>
        <p className="mt-1 text-[12px] text-slate-500">
          {[promo?.trackerStatus, promo?.cps ? `Cps ${promo.cps}` : "", promo?.priority]
            .filter(Boolean)
            .join(" · ") || "From the sheets"}
        </p>
      </div>
      <SyncStrip />

      <Section title="Links">
        <Row label="Krock · 5 min" value={promo?.krockLink5Min} />
        <Row label="Final renders" value={promo?.finalRendersLink} />
        <Row label="Project files" value={promo?.projectFilesLink} />
        <Row label="Final corrected files" value={promo?.finalCorrectedFiles} />
        <Row label="Assets" value={promo?.assetsLink} />
        <Row label="Asset map" value={asset?.assetMapLink} />
        <Row label="Asset canvas" value={asset?.assetCanvasLink} />
        <Row label="Assets drive" value={asset?.assetsDriveLink} />
        <Row label="Canvas" value={promo?.canvasLink} />
        <Row label="Script" value={promo?.workingScriptLink || promo?.scriptLink} />
        <Row label="Agency script" value={promo?.agencyScriptLink} />
        <Row label="Demarcated script" value={promo?.demarcatedScriptLink} />
        <Row label="Show link" value={promo?.showLink} />
        <Row label="Synopsis" value={promo?.synopsisLink || asset?.synopsis} />
        <Row label="VO samples" value={promo?.voSamples} />
        <Row label="Video samples" value={promo?.videoSamples} />
      </Section>

      <Section title="Promo">
        <Row label="Status" value={promo?.trackerStatus || promo?.status} />
        <Row label="Master stage" value={promo?.masterStage} />
        <Row label="Canvas status" value={promo?.canvasStatus} />
        <Row label="Initial duration" value={duration(promo?.initialDurationSec)} />
        <Row label="Final asset length" value={duration(promo?.finalAssetLengthSec)} />
        <Row label="5 min timeline" value={date(promo?.fiveMinTimeline)} />
        <Row label="5 min status" value={promo?.fiveMinStatus} />
        <Row label="Complete deliverable" value={date(promo?.completeDeliverable) || promo?.completeDeliverable} />
        <Row label="Final corrections" value={promo?.deliverableWithFinalCorrections} />
        <Row label="Per min" value={promo?.perMin} />
        <Row label="Promo cost" value={promo?.promoCost} />
        <Row label="Payment" value={promo?.paymentStatus} />
        <Row label="Assets made" value={promo?.totalAssetMade} />
        <Row label="Assets generated" value={promo?.totalAssetGenerated} />
        <Row label="Comments" value={promo?.comments} />
        <Row label="Notes" value={promo?.notes} />
        <Row label="Remarks" value={promo?.remarks} />
      </Section>

      <Section title="Assets">
        <Row label="Status" value={asset?.assetsStatus} />
        <Row label="Artists" value={[asset?.artist1, asset?.artist2, asset?.artist3].filter(Boolean).join(", ")} />
        <Row label="Art lead" value={asset?.artLead} />
        <Row label="Start" value={date(asset?.startDate)} />
        <Row label="End" value={date(asset?.endDate)} />
        <Row label="Total days" value={asset?.totalDays} />
        <Row label="Corrections start" value={date(asset?.correctionsStartDate)} />
        <Row label="Corrections end" value={date(asset?.correctionsEndDate)} />
        <Row label="Correction days" value={asset?.correctionsTotalDays} />
        <Row label="Production days" value={asset?.productionDays} />
        <Row label="Asset count" value={asset?.assetsCount} />
        <Row label="Costing" value={asset?.costing} />
        <Row label="Remarks" value={asset?.remarks} />
        <Row label="Dashverse notes" value={asset?.dashverseNotes} />
        <Row label="Notes" value={asset?.notes} />
      </Section>

      <Section title="Pre-production">
        <Row label="Status" value={pre?.status} />
        <Row label="Artist" value={pre?.artist} />
        <Row label="Total assets" value={pre?.totalAssets} />
        <Row label="Start" value={date(pre?.startDate)} />
        <Row label="Planned" value={date(pre?.plannedDate)} />
        <Row label="Closed" value={date(pre?.closedDate)} />
        <Row label="Assets needed by" value={date(pre?.assetsNeededBy)} />
        <Row label="Remarks" value={pre?.remarksLog.map((entry) => entry.body).join("\n")} />
      </Section>

      <Section title="Parts">
        {parts.length === 0 ? (
          <p className="text-[12px] text-slate-500">No production parts.</p>
        ) : (
          <div className="space-y-3">
            {parts.map((part) => (
              <PartBlock key={part.id} part={part} krocks={krocksFor(reviews, part.partNo)} />
            ))}
          </div>
        )}
      </Section>

      {(plans.length > 0 || remarks.length > 0) && (
        <Section title="Plan">
          {plans.map((cell) => (
            <Row
              key={`${cell.partNo}-${cell.date}-${cell.text}`}
              label={cell.partNo ? `P${cell.partNo}` : "Assets"}
              value={`${date(cell.date)} · ${cell.text}`}
            />
          ))}
          {remarks.map((remark) => (
            <Row
              key={`${remark.partNo}-${remark.at}-${remark.body}`}
              label={remark.partNo ? `P${remark.partNo} remark` : "Remark"}
              value={remark.body}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function krocksFor(
  reviews: { partNo: number; krockLink: string | null; versionCorrection: string | null }[],
  partNo: number
): string[] {
  const links = reviews
    .filter((review) => review.partNo === partNo && review.krockLink)
    .map((review) =>
      review.versionCorrection ? `${review.versionCorrection} · ${review.krockLink}` : review.krockLink!
    );
  return [...new Set(links)];
}

function PartBlock({
  part,
  krocks,
}: {
  part: Part;
  krocks: string[];
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] p-3">
      <p className="text-[13px] font-bold text-white">
        Part {part.partNo}
        <span className="ml-2 text-[12px] font-medium text-slate-400">
          {STAGE_LABEL[part.stage]}
          {part.status ? ` · ${part.status}` : ""}
          {part.team === "agency" ? " · Agency" : ""}
        </span>
      </p>
      <Row label="Artist" value={part.artist} />
      <Row label="Editor" value={part.editors} />
      <Row label="Length" value={duration(part.durationSec)} />
      <Row label="Worked" value={duration(part.workedDurationSec)} />
      <Row label="Days" value={part.days} />
      <Row label="Deadline" value={date(part.deadline)} />
      <Row label="Plotting" value={date(part.plannedPlottedDate)} />
      <Row label="Animation start" value={date(part.aniStartDate)} />
      <Row label="Animation close" value={date(part.aniCloseDate)} />
      <Row label="Edit close" value={date(part.editCloseDate)} />
      <Row label="Correction start" value={date(part.correctionStartDate)} />
      <Row label="Correction end" value={date(part.correctionEndDate)} />
      <Row label="Sound close" value={date(part.soundEndDate)} />
      <Row label="Remarks" value={part.remarks} />
      {krocks.map((link) => {
        const url = link.includes("http") ? link.slice(link.indexOf("http")) : link;
        const pass = link.includes(" · ") ? link.split(" · ")[0] : "";
        return <Row key={link} label={pass ? `Krock · ${pass}` : "Krock"} value={url} />;
      })}
    </div>
  );
}

function duration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "";
  return formatDuration(seconds);
}
