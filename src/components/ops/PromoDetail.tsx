"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  artistName,
  assetClosedDate,
  assetHandoffReady,
  assetsNeededBySuggestion,
  daysLate,
  formatDuration,
  preProdDelayDays,
  STAGE_LABEL,
  STAGE_ORDER,
} from "@/lib/ops/selectors";
import { PFM_DROPDOWNS } from "@/lib/ops/sheet-registry";
import type { PipelineStage } from "@/lib/ops/types";
import { KindPill, PriorityPill, SectionTitle, StagePill } from "./ui";
import { PartActions } from "./PartActions";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

/** Read-only labelled value (Master Tracker fields are edited in Sheets). */
function Field({
  label,
  value,
  children,
  warnIfEmpty,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
  warnIfEmpty?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 text-[13px] font-semibold text-white">
        {children ??
          (value ? (
            value
          ) : (
            <span className={warnIfEmpty ? "text-amber-300" : "text-slate-600"}>
              {warnIfEmpty ? "Unassigned" : "—"}
            </span>
          ))}
      </div>
    </div>
  );
}

function LinkChip({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span className="rounded-md border border-dashed border-white/[0.08] px-2.5 py-1 text-[11px] text-slate-600">
        {label} —
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-[#4361ee]/30 bg-[#4361ee]/10 px-2.5 py-1 text-[11px] font-semibold text-[#9bb0ff] hover:bg-[#4361ee]/20"
    >
      {label} ↗
    </a>
  );
}

export function PromoDetail({ promoId }: { promoId: string }) {
  const { snap, act, busy } = useOps();
  const promo = snap.promos.find((p) => p.id === promoId);
  const parts = snap.parts
    .filter((p) => p.promoId === promoId)
    .sort((a, b) => a.partNo - b.partNo);

  if (!promo) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-300">Promo not found.</p>
        <Link href="/" className="text-[13px] text-slate-400 hover:text-white">
          ← Back to Today
        </Link>
      </div>
    );
  }

  const lengthSec =
    promo.finalAssetLengthSec ?? parts.reduce((s, p) => s + p.durationSec, 0);
  const completeLate = daysLate(promo.completeDeliverable, snap.today);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-[12px] text-slate-500 hover:text-white">
          ← Today
        </Link>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Master · {promo.showName} | {promo.scriptName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            {promo.showName}{" "}
            <span className="text-slate-500">·</span> {promo.scriptName}
          </h1>
          <PriorityPill priority={promo.priority} />
          {promo.masterStage && (
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
              {promo.masterStage}
            </span>
          )}
          {promo.status && <KindPill kind="due-today" />}
        </div>
        <p className="mt-1 text-[12px] text-slate-500">
          Final length {formatDuration(lengthSec)}
          {promo.durationMin != null ? ` (${promo.durationMin} min)` : ""}
          {promo.status ? ` · Status ${promo.status}` : ""}
          {promo.canvasStatus ? ` · Canvas ${promo.canvasStatus}` : ""}
        </p>
      </div>

      <SyncStrip />

      {/* Master Tracker — READ-ONLY (Neeraj edits these directly in Sheets) */}
      <section className="rounded-xl border border-white/[0.08] bg-[#121216] p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <SectionTitle
              title="Master Tracker"
              hint="Read-only · you edit these directly in the sheet"
            />
            <p className="mt-1 text-[11px] text-slate-600">
              Join: {promo.showName} · {promo.scriptName} (cols A–B)
            </p>
          </div>
          <a
            href={snap.workingSource.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-md border border-[#4361ee]/30 bg-[#4361ee]/10 px-2.5 py-1 text-[11px] font-bold text-[#9bb0ff] hover:bg-[#4361ee]/20"
          >
            Edit in sheet ↗
          </a>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="C · Status" value={promo.trackerStatus} />
          <Field label="D · Priority">
            <PriorityPill priority={promo.priority} />
          </Field>
          <Field label="E · Cps (Creative Producer)" value={promo.cps} warnIfEmpty />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="H · Initial Duration"
            value={
              promo.initialDurationSec != null
                ? formatDuration(promo.initialDurationSec)
                : null
            }
          />
          <Field label="Total asset made" value={promo.totalAssetMade?.toString() ?? null} />
          <Field
            label="Total asset generated"
            value={promo.totalAssetGenerated?.toString() ?? null}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              I–K · Scripts (strip PocketFM before agency handoff — non‑negotiable)
            </p>
            <Link
              href="/demarcate"
              className="text-[11px] font-bold text-[#9bb0ff] hover:underline"
            >
              Open demarcation tool →
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <LinkChip
              href={promo.workingScriptLink ?? promo.scriptLink}
              label="I · Script (safety)"
            />
            <LinkChip href={promo.agencyScriptLink} label="J · Agency script" />
            <LinkChip href={promo.demarcatedScriptLink} label="K · Demarcated" />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            L · Remarks
          </p>
          {promo.remarks ? (
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] text-slate-300">
              {promo.remarks}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-slate-600">—</p>
          )}
        </div>
      </section>

      {/* Neeraj's Pre Production Tracker — fill here, not the sheet */}
      {(() => {
        const pp = promo.preProd;
        const delay = preProdDelayDays(promo, snap.today);
        const closedByAsset = assetClosedDate(promo);
        const suggested = assetsNeededBySuggestion(snap, promo);
        return (
          <section className="rounded-xl border border-white/[0.08] bg-[#121216] p-4 space-y-3">
            <SectionTitle
              title="My asset sheet · Pre Production"
              hint="Fill here, not the sheet · picked / planned / delay / append remarks"
            />
            {!pp ? (
              <p className="text-[13px] text-slate-500">
                No Pre Production row yet — set status to create one.
              </p>
            ) : null}
            {promo.assetTeam &&
              (promo.assetTeam.startDate || closedByAsset) &&
              (!pp?.startDate || !pp?.closedDate) && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-slate-300">
                  <span>
                    Asset team: {promo.assetTeam.startDate ?? "—"} →{" "}
                    {closedByAsset ?? "not yet closed"} (close = AC)
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act({
                        type: "set_preprod_dates",
                        promoId: promo.id,
                        startDate: promo.assetTeam?.startDate ?? pp?.startDate ?? null,
                        closedDate: closedByAsset ?? pp?.closedDate ?? null,
                      })
                    }
                    className="rounded-md bg-white/[0.08] px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:text-white"
                  >
                    Pull into my sheet
                  </button>
                  <span className="text-[10px] text-slate-600">
                    Optional copy — asset team sheet stays the source they fill
                  </span>
                </div>
              )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Status
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {["WIP", "Done", "Correction", "Nil"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act({ type: "set_preprod_status", promoId: promo.id, status: s })
                      }
                      className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                        (pp?.status ?? "") === s
                          ? "bg-[#4361ee]/25 text-[#9bb0ff]"
                          : "bg-white/[0.05] text-slate-400 hover:text-white"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Artist
                </p>
                <p className="mt-1 text-[13px] font-semibold text-white">
                  {pp?.artist ?? "—"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {["Gowtham", "Shirso", "Somya", "Deepthesha", "Merlyn"].map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act({ type: "set_preprod_artist", promoId: promo.id, artist: name })
                      }
                      className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-white"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Picked by animation
                </p>
                <p className="mt-1 text-[13px] font-semibold text-white">
                  {pp?.pickedAt ?? <span className="text-slate-500">Not picked</span>}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act({
                      type: "mark_assets_picked",
                      promoId: promo.id,
                      pickedAt: pp?.pickedAt ? null : snap.today,
                    })
                  }
                  className="mt-1.5 rounded-md bg-gradient-to-r from-[#4361ee]/30 to-[#d6293d]/25 px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  {pp?.pickedAt ? "Clear picked" : "Mark picked today"}
                </button>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Delay
                </p>
                <p className="mt-1 text-[13px] font-semibold">
                  {closedByAsset ? (
                    <span className="text-emerald-300">Closed by assets · {closedByAsset}</span>
                  ) : delay > 0 || pp?.delayFlagged ? (
                    <span className="text-rose-300">
                      {pp?.delayFlagged ? "Flagged" : `${delay}d late · not yet closed`}
                    </span>
                  ) : (
                    <span className="text-emerald-300">On track</span>
                  )}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act({
                      type: "set_delay_flag",
                      promoId: promo.id,
                      flagged: !pp?.delayFlagged,
                    })
                  }
                  className="mt-1.5 rounded-md bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300"
                >
                  {pp?.delayFlagged ? "Clear delay flag" : "Flag delay"}
                </button>
              </div>
            </div>

            <form
              className="grid gap-2 sm:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                await act({
                  type: "set_preprod_dates",
                  promoId: promo.id,
                  startDate: String(fd.get("start") || "") || null,
                  plannedDate: String(fd.get("planned") || "") || null,
                  closedDate: String(fd.get("closed") || "") || null,
                });
              }}
            >
              {(
                [
                  ["start", "Start", pp?.startDate],
                  ["planned", "Planned", pp?.plannedDate],
                  ["closed", "Closed", pp?.closedDate],
                ] as const
              ).map(([name, label, val]) => (
                <label key={name} className="block text-[11px] text-slate-500">
                  {label}
                  <input
                    name={name}
                    type="date"
                    defaultValue={val ?? ""}
                    className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#0e0e13] px-2 py-1.5 text-[13px] text-white"
                  />
                </label>
              ))}
              <div className="flex flex-col justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] font-bold text-slate-200"
                >
                  Save dates
                </button>
              </div>
            </form>

            {suggested && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#4361ee]/25 bg-[#4361ee]/10 px-3 py-2 text-[12px]">
                <span className="text-slate-200">
                  Animation free ~<span className="font-bold text-white">{suggested}</span>
                  {" → "}
                  ask assets by then
                  {pp?.assetsNeededBy ? ` (set: ${pp.assetsNeededBy})` : ""}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act({
                      type: "set_assets_needed_by",
                      promoId: promo.id,
                      date: suggested,
                    })
                  }
                  className="rounded-md bg-gradient-to-r from-[#4361ee] to-[#d6293d] px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  Set assets needed by {suggested}
                </button>
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Remarks log (append-only)
              </p>
              <ul className="mt-1.5 max-h-36 space-y-1.5 overflow-y-auto">
                {(pp?.remarksLog ?? []).length === 0 && (
                  <li className="text-[12px] text-slate-600">No remarks yet.</li>
                )}
                {(pp?.remarksLog ?? []).map((r) => (
                  <li
                    key={r.id}
                    className="rounded-md bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-slate-300"
                  >
                    <span className="text-[10px] font-bold text-slate-500">{r.at}</span>
                    {" — "}
                    {r.body}
                  </li>
                ))}
              </ul>
              <form
                className="mt-2 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const body = String(fd.get("body") ?? "").trim();
                  if (!body) return;
                  await act({ type: "append_preprod_remark", promoId: promo.id, body });
                  e.currentTarget.reset();
                }}
              >
                <input
                  name="body"
                  placeholder="Add remark…"
                  className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-[#0e0e13] px-3 py-2 text-[13px] text-white placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-gradient-to-r from-[#4361ee] to-[#d6293d] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-40"
                >
                  Add
                </button>
              </form>
            </div>
          </section>
        );
      })()}

      {/* Asset team handoff — critical for animation */}
      {(() => {
        const handoff = assetHandoffReady(promo);
        const a = promo.assetTeam;
        const closedOn = assetClosedDate(promo);
        return (
          <section
            className={`rounded-xl border bg-[#121216] p-4 space-y-3 ${
              handoff.ready
                ? "border-emerald-500/25"
                : "border-rose-500/30 border-l-[3px] border-l-rose-500"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionTitle
                title="Asset team sheet · handoff"
                hint="Promos - Assets Master · close = Corrections End Date (AC)"
              />
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    closedOn
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {closedOn ? `Closed · ${closedOn}` : "Not yet closed"}
                </span>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    handoff.ready ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {handoff.ready ? "Ready" : `Missing: ${handoff.missing.join(", ")}`}
                </span>
              </div>
            </div>
            {!a ? (
              <p className="text-[13px] text-slate-500">
                No row on Promos - Assets Master Sheet yet.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <LinkChip href={a.assetMapLink} label="Asset Map" />
                  <LinkChip href={a.assetCanvasLink} label="Canvas Link" />
                  <LinkChip href={a.assetsDriveLink} label="Assets Drive" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3 text-[12px]">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Assets status
                    </p>
                    <p className="mt-0.5 font-semibold text-white">{a.assetsStatus ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Artists
                    </p>
                    <p className="mt-0.5 text-slate-200">
                      {[a.artist1, a.artist2, a.artist3].filter(Boolean).join(" · ") || "—"}
                      {a.artLead ? ` · Lead ${a.artLead}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Dates · close = Corrections End (AC)
                    </p>
                    <p className="mt-0.5 tabular-nums text-slate-200">
                      {a.startDate ?? "—"} → {closedOn ?? "not closed"}
                      {a.totalDays != null ? ` · ${a.totalDays}d` : ""}
                    </p>
                    {a.endDate && (
                      <p className="mt-0.5 text-[10px] text-slate-600">
                        First pass end (Z): {a.endDate}
                      </p>
                    )}
                  </div>
                </div>
                {(a.remarks || a.notes || a.assetsCount) && (
                  <div className="space-y-1 text-[12px] text-slate-400">
                    {a.remarks && <p>{a.remarks}</p>}
                    {a.notes && <p className="text-amber-200/80">{a.notes}</p>}
                    {a.assetsCount && (
                      <p className="text-slate-500">{a.assetsCount}</p>
                    )}
                  </div>
                )}
                {(a.correctionsStartDate || a.costing != null) && (
                  <p className="text-[11px] text-slate-600">
                    {a.correctionsStartDate &&
                      `Corrections ${a.correctionsStartDate} → ${a.correctionsEndDate ?? "—"}`}
                    {a.costing != null &&
                      `${a.correctionsStartDate ? " · " : ""}Costing ${a.costing.toLocaleString()}`}
                  </p>
                )}
              </>
            )}
          </section>
        );
      })()}

      {promo.completeDeliverable && (
        <section
          className={`rounded-xl border border-white/[0.08] bg-[#121216] p-4 ${
            completeLate > 0 ? "border-l-[3px] border-l-rose-500" : ""
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Complete deliverable
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-white">
            {promo.completeDeliverable}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {completeLate > 0
              ? `${completeLate}d late`
              : promo.completeDeliverable === snap.today
                ? "due today"
                : "on track / upcoming"}
          </p>
        </section>
      )}

      {/* Story / refs — Neeraj grouping */}
      <section className="space-y-2">
        <SectionTitle title="Story & references" hint="Script → Canvas → VO → Samples" />
        <div className="flex flex-wrap gap-2">
          <LinkChip href={promo.scriptLink} label="Script" />
          <LinkChip href={promo.canvasLink} label="Canvas" />
          <LinkChip href={promo.voSamples} label="VO samples" />
          <LinkChip href={promo.videoSamples} label="Video samples" />
          <LinkChip href={promo.showLink} label="Show link" />
          <LinkChip href={promo.synopsisLink} label="Synopsis" />
          <LinkChip href={promo.finalRendersLink} label="Final renders" />
          <LinkChip href={promo.projectFilesLink} label="Project files" />
          <LinkChip href={promo.assetsLink} label="Assets" />
        </div>
      </section>

      {(promo.comments || promo.notes) && (
        <section className="grid gap-3 lg:grid-cols-2">
          {promo.comments && (
            <div className="rounded-xl border border-white/[0.08] bg-[#121216] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Comments
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-200">{promo.comments}</p>
            </div>
          )}
          {promo.notes && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-amber-50">{promo.notes}</p>
            </div>
          )}
        </section>
      )}

      {/* Completion write-back to PocketFM Master Sheet is automatic:
          when all parts reach Delivered → Stage/Status + delivery links only. */}

      <section className="space-y-2">
        <SectionTitle
          title="My animation sheet · Production Tracker"
          hint="Parts feed from demarcated script · flow: planning → animation → edit → correction → sound"
        />
        {parts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-[13px] text-slate-600">
            No parts yet — link a demarcated script (col K); parts will feed in from that split.
            {promo.demarcatedScriptLink ? (
              <span className="mt-1 block text-amber-300/90">
                Demarcated script is linked — sync from Doc will populate Part 1…N automatically once write-back is live.
              </span>
            ) : null}
          </p>
        ) : (
          <div className="space-y-2">
            {parts.map((partRow) => {
              const late = daysLate(partRow.plannedDate, snap.today);
              return (
                <article
                  key={partRow.id}
                  className={`rounded-xl border border-white/[0.08] bg-[#121216] p-4 space-y-3 ${
                    late > 0
                      ? "border-l-[3px] border-l-rose-500"
                      : partRow.blocked
                        ? "border-l-[3px] border-l-amber-400"
                        : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold text-white">
                          Part {partRow.partNo}
                        </span>
                        <StagePill stage={partRow.stage} />
                        {partRow.status && (
                          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-slate-400">
                            {partRow.status}
                          </span>
                        )}
                        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          {partRow.team === "agency" ? "Agency" : "In house"}
                        </span>
                        {late > 0 && <KindPill kind="overdue" />}
                        {partRow.blocked && <KindPill kind="blocked" />}
                      </div>
                      <p className="mt-1 text-[12px] text-slate-500">
                        Duration {formatDuration(partRow.durationSec)}
                        {partRow.workedDurationSec != null
                          ? ` · worked ${formatDuration(partRow.workedDurationSec)}`
                          : ""}
                        {partRow.deadline ? ` · deadline ${partRow.deadline}` : ""}
                        {partRow.days != null ? ` · ${partRow.days}d` : ""}
                      </p>
                      {partRow.blockReason && (
                        <p className="mt-1 text-[12px] text-amber-300">{partRow.blockReason}</p>
                      )}
                    </div>
                    <PartActions partId={partRow.id} />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {STAGE_ORDER.map((s) => {
                      const current = partRow.stage === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act({
                              type: "set_part_stage",
                              partId: partRow.id,
                              stage: s as PipelineStage,
                            })
                          }
                          className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                            current
                              ? "bg-gradient-to-r from-[#4361ee]/40 to-[#d6293d]/30 text-white"
                              : "bg-white/[0.04] text-slate-500 hover:text-white"
                          }`}
                        >
                          {STAGE_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[12px]">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Artist
                      </p>
                      <p className="mt-0.5 font-semibold text-white">
                        {partRow.artist ??
                          (partRow.artists[0]
                            ? artistName(snap, partRow.artists[0].artistId)
                            : "—")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {snap.animators.slice(0, 6).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              act({
                                type: "set_part_artist",
                                partId: partRow.id,
                                artist: a.name,
                              })
                            }
                            className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white"
                          >
                            {a.name.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Editors
                      </p>
                      <p className="mt-0.5 font-semibold text-white">
                        {partRow.editors ?? "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {PFM_DROPDOWNS.editors.slice(0, 6).map((name) => (
                          <button
                            key={name}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              act({
                                type: "set_part_editor",
                                partId: partRow.id,
                                editors: name,
                              })
                            }
                            className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Status
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {["WIP", "Done", "1st Correction", "2nd Correction"].map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              act({
                                type: "set_part_status",
                                partId: partRow.id,
                                status: s,
                              })
                            }
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              partRow.status === s
                                ? "bg-[#4361ee]/25 text-[#9bb0ff]"
                                : "bg-white/[0.05] text-slate-400 hover:text-white"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Team · Assets (from Pre-Prod)
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act({
                              type: "set_part_team",
                              partId: partRow.id,
                              team: "in_house",
                            })
                          }
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            partRow.team === "in_house"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-white/[0.05] text-slate-400"
                          }`}
                        >
                          In house
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act({
                              type: "set_part_team",
                              partId: partRow.id,
                              team: "agency",
                            })
                          }
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            partRow.team === "agency"
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-white/[0.05] text-slate-400"
                          }`}
                        >
                          Agency
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Assets: {promo.preProd?.status ?? "—"}
                      </p>
                    </div>
                  </div>

                  <form
                    className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      await act({
                        type: "set_part_dates",
                        partId: partRow.id,
                        deadline: String(fd.get("deadline") || "") || null,
                        plannedPlottedDate: String(fd.get("plotted") || "") || null,
                        aniStartDate: String(fd.get("aniStart") || "") || null,
                        aniCloseDate: String(fd.get("aniClose") || "") || null,
                        editCloseDate: String(fd.get("editClose") || "") || null,
                        correctionStartDate: String(fd.get("corrStart") || "") || null,
                        correctionEndDate: String(fd.get("corrEnd") || "") || null,
                        soundEndDate: String(fd.get("soundEnd") || "") || null,
                      });
                    }}
                  >
                    {(
                      [
                        ["deadline", "Deadline", partRow.deadline],
                        ["plotted", "Plotted", partRow.plannedPlottedDate],
                        ["aniStart", "Ani start", partRow.aniStartDate],
                        ["aniClose", "Ani close", partRow.aniCloseDate],
                        ["editClose", "Edit close", partRow.editCloseDate],
                        ["corrStart", "Corr start", partRow.correctionStartDate],
                        ["corrEnd", "Corr end", partRow.correctionEndDate],
                        ["soundEnd", "Sound end", partRow.soundEndDate],
                      ] as const
                    ).map(([name, label, val]) => (
                      <label key={name} className="block text-[10px] text-slate-500">
                        {label}
                        <input
                          name={name}
                          type="date"
                          defaultValue={val ?? ""}
                          className="mt-0.5 w-full rounded border border-white/[0.1] bg-[#0e0e13] px-1.5 py-1 text-[11px] text-white"
                        />
                      </label>
                    ))}
                    <div className="sm:col-span-4 lg:col-span-8 flex justify-end">
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-slate-200"
                      >
                        Save dates
                      </button>
                    </div>
                  </form>

                  {partRow.remarks && (
                    <p className="text-[12px] text-slate-400">{partRow.remarks}</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
